'use strict';

/**
 * SOC Radar - Phase 2: Live Gateway (server.js)
 *
 * Acts as the bridge between the MariaDB database and the Next.js frontend.
 * Provides:
 *  - REST API for historical data on initial page load
 *  - WebSocket (Socket.io) for real-time event streaming
 *  - Internal HTTP endpoint for the Phase 1 Collector to push new events
 *
 * Usage:
 *   cp .env.example .env
 *   npm install
 *   node server.js
 */

require('dotenv').config();

const http      = require('http');
const express   = require('express');
const { Server} = require('socket.io');
const cors      = require('cors');
const helmet    = require('helmet');
const mysql     = require('mysql2/promise');

// ─────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────
const config = {
  port           : parseInt(process.env.PORT           || '3001', 10),
  frontendOrigin : process.env.FRONTEND_ORIGIN         || 'http://localhost:3000',
  internalApiKey : process.env.INTERNAL_API_KEY        || 'changeme-use-a-real-secret',
  db: {
    host               : process.env.DB_HOST            || '127.0.0.1',
    port               : parseInt(process.env.DB_PORT   || '3306', 10),
    user               : process.env.DB_USER            || 'soc_collector',
    password           : process.env.DB_PASSWORD        || '',
    database           : process.env.DB_NAME            || 'soc_radar',
    waitForConnections : true,
    connectionLimit    : 10,
    queueLimit         : 0,
    enableKeepAlive    : true,
    keepAliveInitialDelay: 10000,
  },
};

// ─────────────────────────────────────────────
// 2. DATABASE MODULE
// ─────────────────────────────────────────────
let pool = null;

async function createPool(retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      pool = mysql.createPool(config.db);
      const conn = await pool.getConnection();
      conn.release();
      console.log('[DB] Connected to MariaDB pool successfully.');
      return;
    } catch (err) {
      const wait = delayMs * attempt;
      console.error(`[DB] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw new Error('[DB] Max retries reached. Exiting.');
      console.log(`[DB] Retrying in ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
}

// ─────────────────────────────────────────────
// 3. EXPRESS APP + HTTP SERVER
// ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// Security headers (disable CSP directives that block Socket.io in dev)
app.use(helmet({ contentSecurityPolicy: false }));

// JSON body parsing
app.use(express.json({ limit: '16kb' }));

// CORS — only allow the frontend origin for public routes
const corsOptions = {
  origin : config.frontendOrigin,
  methods: ['GET', 'OPTIONS'],
};

// ─────────────────────────────────────────────
// 4. SOCKET.IO SERVER
// ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin : config.frontendOrigin,
    methods: ['GET', 'POST'],
  },
  // Prefer WebSocket, fall back to polling
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`[Socket.io] Client connected: ${socket.id} (${clientIp}). Total: ${io.engine.clientsCount}`);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}. Reason: ${reason}`);
  });
});

// ─────────────────────────────────────────────
// 5. REST ROUTES — PUBLIC
// ─────────────────────────────────────────────

/**
 * GET /api/health
 * Simple liveness probe used by Docker HEALTHCHECK.
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/events/recent
 * Returns the last 100 security events, newest first.
 * Called once by the frontend on initial page load to populate the dashboard.
 */
app.get('/api/events/recent', cors(corsOptions), async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);

  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         timestamp,
         event_type,
         ip_address,
         targeted_user,
         country,
         city,
         latitude,
         longitude
       FROM security_events
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[REST] /api/events/recent error:', err.message);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

/**
 * GET /api/events/stats
 * Returns aggregate stats for dashboard widgets:
 *  - Total event counts grouped by event_type (last 24h)
 *  - Top 10 attacker IP addresses (last 24h)
 */
app.get('/api/events/stats', cors(corsOptions), async (req, res) => {
  try {
    const [[countsByType], [topAttackers]] = await Promise.all([
      // Counts grouped by event_type in the last 24 hours
      pool.execute(
        `SELECT
           event_type,
           COUNT(*) AS total
         FROM security_events
         WHERE timestamp >= NOW() - INTERVAL 24 HOUR
         GROUP BY event_type
         ORDER BY total DESC`
      ),
      // Top 10 IPs by number of failed SSH attempts in the last 24 hours
      pool.execute(
        `SELECT
           ip_address,
           country,
           city,
           COUNT(*) AS attempt_count
         FROM security_events
         WHERE event_type = 'SSH_FAILED'
           AND timestamp >= NOW() - INTERVAL 24 HOUR
         GROUP BY ip_address, country, city
         ORDER BY attempt_count DESC
         LIMIT 10`
      ),
    ]);

    res.json({
      success     : true,
      countsByType,
      topAttackers,
    });
  } catch (err) {
    console.error('[REST] /api/events/stats error:', err.message);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// ─────────────────────────────────────────────
// 6. INTERNAL ROUTE — Phase 1 → Phase 2 Bridge
// ─────────────────────────────────────────────

/**
 * Middleware: validates the shared INTERNAL_API_KEY.
 * The Phase 1 Collector sends this key in the `x-internal-key` header.
 */
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== config.internalApiKey) {
    console.warn(`[Internal] Unauthorized notify attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

/**
 * POST /internal/notify
 *
 * Called by the Phase 1 Log Collector immediately after inserting a new event.
 * Broadcasts the event to all connected Socket.io clients in real-time.
 *
 * Expected body:
 * {
 *   "event_type":    "SSH_FAILED",
 *   "ip_address":    "1.2.3.4",
 *   "targeted_user": "root",
 *   "country":       "CN",
 *   "city":          "Beijing",
 *   "latitude":      39.9289,
 *   "longitude":     116.3883
 * }
 */
app.post('/internal/notify', requireInternalKey, (req, res) => {
  const event = req.body;

  if (!event || !event.event_type || !event.ip_address) {
    return res.status(400).json({ error: 'Invalid event payload.' });
  }

  // Stamp a server-side ISO timestamp for the frontend
  const payload = { ...event, receivedAt: new Date().toISOString() };

  // Broadcast to ALL connected browser clients simultaneously
  const clientCount = io.engine.clientsCount;
  io.emit('new_event', payload);

  console.log(`[Internal] Broadcasted [${event.event_type}] from ${event.ip_address} to ${clientCount} client(s).`);
  res.json({ success: true, broadcastedTo: clientCount });
});

// ─────────────────────────────────────────────
// 7. 404 FALLBACK
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─────────────────────────────────────────────
// 8. UTILITY
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// 9. STARTUP & GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   SOC Radar - Phase 2 Live Gateway   ║');
  console.log('╚══════════════════════════════════════╝');

  await createPool();

  server.listen(config.port, () => {
    console.log(`[Server] Listening on port ${config.port}`);
    console.log(`[Server] REST:      http://localhost:${config.port}/api/events/recent`);
    console.log(`[Server] WebSocket: ws://localhost:${config.port}`);
    console.log(`[Server] Frontend:  ${config.frontendOrigin}`);
  });
}

async function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    if (pool) {
      await pool.end();
      console.log('[DB] Pool closed.');
    }
    process.exit(0);
  });
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason);
});

main().catch((err) => {
  console.error('[Fatal] Startup error:', err.message);
  process.exit(1);
});
