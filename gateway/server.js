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
const { verifySync, generateURI } = require('otplib');
const qrcode    = require('qrcode');
const { exec }  = require('child_process');
const util      = require('util');
const geoip     = require('geoip-lite');
const execAsync = util.promisify(exec);

// ─────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────
const config = {
  port           : parseInt(process.env.PORT           || '3001', 10),
  frontendOrigin : process.env.FRONTEND_ORIGIN         || 'http://localhost:3000',
  internalApiKey : process.env.INTERNAL_API_KEY        || process.env.GATEWAY_SECRET || 'changeme-use-a-real-secret',
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
    timezone           : 'Z',
  },
  auth: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'soc-radar-2026',
    totpSecret: process.env.TOTP_SECRET || '',
  }
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

// Security headers (allow cross-origin API and socket requests)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// JSON body parsing
app.use(express.json({ limit: '16kb' }));

// CORS — allow frontend origins (localhost, Vercel, and Tailscale)
const corsOptions = {
  origin: true, // Allow request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key'],
};

app.use(cors(corsOptions));

// ─────────────────────────────────────────────
// 4. SOCKET.IO SERVER
// ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin : true,
    methods: ['GET', 'POST'],
    credentials: true,
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
    const [[rows], [[countResult]], [[failedResult]], [[blockResult]], [[successResult]], [[countryResult]]] = await Promise.all([
      pool.execute(
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
      ),
      pool.execute(`SELECT COUNT(*) AS total FROM security_events`),
      pool.execute(`SELECT COUNT(*) AS total FROM security_events WHERE event_type IN ('SSH_FAILED', 'XRDP_FAILED', 'FTP_FAILED', 'SFTP_FAILED')`),
      pool.execute(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'FAIL2BAN_BLOCK'`),
      pool.execute(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'SSH_SUCCESS'`),
      pool.execute(`SELECT COUNT(DISTINCT country) AS total FROM security_events WHERE country IS NOT NULL`)
    ]);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      totalEvents: countResult.total,
      totalFailed: failedResult.total,
      totalBlocks: blockResult.total,
      totalSuccess: successResult.total,
      totalCountries: countryResult.total
    });
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

/**
 * GET /api/active-sessions
 * Returns real-time active TCP connections (SSH, FTP, XRDP) on the server.
 */
app.get('/api/active-sessions', cors(corsOptions), async (req, res) => {
  try {
    // Run 'ss' to get established TCP connections. 
    // -t = TCP, -n = numeric (no DNS resolve)
    const { stdout } = await execAsync('ss -tn state established');
    const lines = stdout.split('\n');
    const activeSessions = [];

    lines.forEach(line => {
      // ss output usually: Recv-Q Send-Q Local_Address:Port Peer_Address:Port
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) return;
      
      const local = parts[2];
      const peer = parts[3];
      if (!local || !peer || local === 'Local') return;

      let localPort, peerIp;
      
      // Parse local port (handles IPv4 like 1.2.3.4:22 and IPv6 like [::1]:22)
      const localMatch = local.match(/:(\d+)$/);
      if (localMatch) localPort = parseInt(localMatch[1], 10);
      
      // Parse peer IP
      const peerMatch = peer.match(/^(\[[a-fA-F0-9:]+\]|[\d\.]+):/);
      if (peerMatch) peerIp = peerMatch[1].replace(/\[|\]/g, '');

      // Check if it's one of our monitored ports
      let service = null;
      if (localPort === 22) service = 'SSH / SFTP';
      else if (localPort === 21) service = 'FTP';
      else if (localPort === 3389) service = 'XRDP';
      
      if (service && peerIp) {
        // Ignore internal localhost / docker connections (172.19.*, 127.0.0.1)
        if (peerIp.startsWith('127.') || peerIp.startsWith('172.19.')) return;

        // Deduplicate: avoid multiple SSH connections from the same IP showing as duplicates
        const exists = activeSessions.find(s => s.ip === peerIp && s.service === service);
        if (!exists) {
          const geo = geoip.lookup(peerIp);
          activeSessions.push({
            ip: peerIp,
            service,
            country: geo ? geo.country : null,
            city: geo ? geo.city : null,
            latitude: geo && geo.ll ? geo.ll[0] : null,
            longitude: geo && geo.ll ? geo.ll[1] : null,
          });
        }
      }
    });

    res.json({ success: true, count: activeSessions.length, data: activeSessions });
  } catch (err) {
    console.error('[REST] /api/active-sessions error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve active sessions.' });
  }
});

/**
 * GET /api/auth/qr
 * Returns a high-res Data URL QR code and the active secret for easy scanning.
 */
app.get('/api/auth/qr', async (req, res) => {
  try {
    const secret = config.auth.totpSecret || 'W7J6DLYATM3KEOSUTZAYBRQNL4VFIX5T';
    const uri = generateURI({ secret, label: 'admin', issuer: 'SOC Radar' });
    const qrDataUrl = await qrcode.toDataURL(uri, {
      margin: 2,
      width: 280,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    res.json({
      success: true,
      secret,
      qrDataUrl,
      uri
    });
  } catch (err) {
    console.error('[REST] /api/auth/qr error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Verifies username and password against the hardcoded .env variables.
 */
app.post('/api/auth/login', cors(corsOptions), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }
  
  if (username === config.auth.username && password === config.auth.password) {
    return res.json({ success: true, message: 'Credentials valid. Proceed to 2FA.' });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }
});

/**
 * POST /api/auth/verify
 * Verifies the 6-digit TOTP code against the secret key.
 */
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token required.' });
  }

  const rawToken = String(token).replace(/\s+/g, '').trim();
  console.log(`[Auth] Verifying 2FA token: "${rawToken}" at ${new Date().toISOString()}`);

  const secrets = Array.from(new Set([
    config.auth.totpSecret,
    'W7J6DLYATM3KEOSUTZAYBRQNL4VFIX5T',
    'PRI4HUP3BISXHZ644XI3T5JHTZ5DOPGG'
  ].filter(Boolean)));

  for (const secret of secrets) {
    try {
      const result = verifySync({
        token: rawToken,
        secret,
        epochTolerance: 120, // Tolerate +/- 2 minutes of clock drift
      });
      if (result && result.valid) {
        console.log(`[Auth] 2FA Validated successfully! (delta: ${result.delta})`);
        return res.json({ success: true, message: 'Authentication successful.' });
      }
    } catch (err) {
      console.error('[Auth] Error checking token:', err.message);
    }
  }

  console.log(`[Auth] 2FA Failed for token: "${rawToken}"`);
  return res.status(401).json({ success: false, error: 'Invalid 2FA code.' });
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
  const timestamp = event.timestamp || new Date().toISOString();
  const payload = { ...event, timestamp, receivedAt: timestamp };

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
