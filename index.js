'use strict';

/**
 * SOC Radar - Phase 1: Log Collector (index.js) — UPDATED for Phase 2
 *
 * Changes in this version:
 *  - After successfully inserting an event into the DB, it POSTs the event
 *    to the Phase 2 Gateway's /internal/notify endpoint so the Gateway can
 *    instantly broadcast it to connected browser clients via WebSocket.
 */

require('dotenv').config();
const { spawn } = require('child_process');
const readline  = require('readline');
const mysql     = require('mysql2/promise');
const geoip     = require('geoip-lite');

// ─────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────
const config = {
  db: {
    host                 : process.env.DB_HOST     || '127.0.0.1',
    port                 : parseInt(process.env.DB_PORT || '3306', 10),
    user                 : process.env.DB_USER     || 'soc_collector',
    password             : process.env.DB_PASSWORD || '',
    database             : process.env.DB_NAME     || 'soc_radar',
    waitForConnections   : true,
    connectionLimit      : 5,
    queueLimit           : 0,
    enableKeepAlive      : true,
    keepAliveInitialDelay: 10000,
    timezone             : 'Z',
  },
  logSource: process.env.LOG_SOURCE || 'journalctl',

  // ── Phase 2 Gateway notification ─────────────────────────
  // Set GATEWAY_URL to the gateway's /internal/notify endpoint.
  // When running locally (host → Docker), use http://localhost:3001
  gatewayUrl    : process.env.GATEWAY_URL     || 'http://localhost:3001/internal/notify',
  internalApiKey: process.env.INTERNAL_API_KEY || 'changeme-use-a-real-secret',
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
      return pool;
    } catch (err) {
      const wait = delayMs * attempt;
      console.error(`[DB] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        throw new Error('[DB] Could not connect to MariaDB after maximum retries. Exiting.');
      }
      console.log(`[DB] Retrying in ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
}

/**
 * Inserts a parsed security event into the database,
 * then notifies the Phase 2 Gateway for real-time broadcasting.
 *
 * @param {Object} event - The enriched security event.
 */
async function insertEvent(event) {
  if (!pool) return;

  const sql = `
    INSERT INTO security_events
      (timestamp, event_type, ip_address, targeted_user, country, city, latitude, longitude, raw_log)
    VALUES
      (NOW(3), ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    event.event_type,
    event.ip_address,
    event.targeted_user || null,
    event.country       || null,
    event.city          || null,
    event.latitude      || null,
    event.longitude     || null,
    event.raw_log       || null,
  ];

  try {
    await pool.execute(sql, values);
    console.log(`[DB] Inserted [${event.event_type}] from ${event.ip_address} (${event.country || 'unknown'}, ${event.city || 'unknown'})`);

    // ── Notify Phase 2 Gateway (fire-and-forget) ──────────────
    // We do NOT await this — if the gateway is down, the DB insert already succeeded.
    notifyGateway(event);

  } catch (err) {
    console.error(`[DB] Insert failed for event [${event.event_type}]: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// 3. GATEWAY NOTIFICATION MODULE (Phase 2 Bridge)
// ─────────────────────────────────────────────

/**
 * POSTs the enriched event to the Phase 2 Gateway's /internal/notify endpoint.
 * The Gateway will immediately broadcast it to all connected Socket.io clients.
 *
 * This function NEVER throws — failures are logged silently so the collector
 * continues operating even if the gateway is temporarily unavailable.
 *
 * Uses Node 18's built-in fetch() — no extra dependencies needed.
 *
 * @param {Object} event - The enriched security event to forward.
 */
async function notifyGateway(event) {
  try {
    const response = await fetch(config.gatewayUrl, {
      method : 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'x-internal-key': config.internalApiKey,
      },
      body   : JSON.stringify({
        event_type   : event.event_type,
        ip_address   : event.ip_address,
        targeted_user: event.targeted_user || null,
        country      : event.country       || null,
        city         : event.city          || null,
        latitude     : event.latitude      || null,
        longitude    : event.longitude     || null,
        timestamp    : new Date().toISOString(),
      }),
      // Short timeout — don't let a slow gateway stall the collector
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`[Gateway] Notify returned HTTP ${response.status}`);
    }
  } catch (err) {
    // Gateway may be starting up or temporarily down — this is non-fatal
    console.warn(`[Gateway] Notify failed (non-fatal): ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// 4. PARSER MODULE
// ─────────────────────────────────────────────
const PATTERNS = [
  // ── SSH ──────────────────────────────────────────────────────────────────
  {
    event_type : 'SSH_FAILED',
    regex      : /Failed (?:password|publickey) for (?:invalid user )?(\S+) from ([\d.a-fA-F:]+) port/,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  {
    event_type : 'SSH_SUCCESS',
    regex      : /Accepted (?:password|publickey) for (\S+) from ([\d.a-fA-F:]+) port/,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // ── Fail2Ban ─────────────────────────────────────────────────────────────
  {
    event_type : 'FAIL2BAN_BLOCK',
    regex      : /\[sshd\] Ban ([\d.a-fA-F:]+)/,
    extract    : (m) => ({ ip_address: m[1], targeted_user: null }),
  },
  {
    event_type : 'FAIL2BAN_UNBLOCK',
    regex      : /\[sshd\] Unban ([\d.a-fA-F:]+)/,
    extract    : (m) => ({ ip_address: m[1], targeted_user: null }),
  },
  // ── XRDP (/var/log/xrdp-sesman.log) ─────────────────────────────────────
  {
    event_type : 'XRDP_SUCCESS',
    regex      : /sesman_auth.*auth\s+valid.*user\s+(\S+)\s+from\s+ip\s+([\d.]+)/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  {
    event_type : 'XRDP_SUCCESS',
    regex      : /login successful for user (\S+) on display.*?([\d]{1,3}(?:\.[\d]{1,3}){3})/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  {
    event_type : 'XRDP_FAILED',
    regex      : /sesman_auth.*auth(?:fail| not valid).*?user\s+(\S+)\s+from\s+ip\s+([\d.]+)/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // Fallback XRDP pattern (no username in log)
  {
    event_type : 'XRDP_FAILED',
    regex      : /(?:xrdp|sesman).*(?:auth|login)\s+fail.*?([\d]{1,3}(?:\.[\d]{1,3}){3})/i,
    extract    : (m) => ({ targeted_user: null, ip_address: m[1] }),
  },
  // ── FTP (vsftpd: /var/log/vsftpd.log) ────────────────────────────────────
  {
    event_type : 'FTP_SUCCESS',
    regex      : /\[([^\]]+)\]\s+OK LOGIN:\s+Client\s+"([\d.]+)"/i,
    extract    : (m) => ({ targeted_user: m[1] === 'anonymous' ? null : m[1], ip_address: m[2] }),
  },
  // Format: [pid XXXX] [user] FAIL LOGIN: Client "1.2.3.4"
  {
    event_type : 'FTP_FAILED',
    regex      : /\[([^\]]+)\]\s+FAIL LOGIN:\s+Client\s+"([\d.]+)"/i,
    extract    : (m) => ({ targeted_user: m[1] === 'anonymous' ? null : m[1], ip_address: m[2] }),
  },
  // ProFTPD / generic FTP fail fallback
  {
    event_type : 'FTP_FAILED',
    regex      : /(?:ftp|proftpd|pure-ftpd).*(?:failed|denied|rejected|invalid).*?([\d]{1,3}(?:\.[\d]{1,3}){3})/i,
    extract    : (m) => ({ targeted_user: null, ip_address: m[1] }),
  },
  // ── SFTP (OpenSSH subsystem — auth.log/journalctl) ───────────────────────
  {
    event_type : 'SFTP_SUCCESS',
    regex      : /Accepted (?:password|publickey) for (\S+) from ([\d.a-fA-F:]+) port.*sftp/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // SFTP logins appear in auth.log like SSH but with sftp subsystem
  {
    event_type : 'SFTP_FAILED',
    regex      : /Failed (?:password|publickey) for (?:invalid user )?(\S+) from ([\d.a-fA-F:]+) port.*sftp/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // ProFTPD with SFTP module
  {
    event_type : 'SFTP_FAILED',
    regex      : /mod_sftp.*(?:failed|denied|error).*?([\d]{1,3}(?:\.[\d]{1,3}){3})/i,
    extract    : (m) => ({ targeted_user: null, ip_address: m[1] }),
  },
  // ── SMB / Samba (/var/log/samba/log.smbd) ──────────────────────────────
  {
    event_type : 'SMB_SUCCESS',
    // Example: Auth: [SMB2,(null)] user []\[kawash] at ... status [NT_STATUS_OK] ... remote host [ipv4:100.119.82.94:58223]
    regex      : /Auth: \[.*?\] user \[.*?\]\\\[(.*?)\] .*? status \[NT_STATUS_OK\] .*? remote host \[ipv4:([0-9.]+):.*\]/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  {
    event_type : 'SMB_FAILED',
    // Catch access denied or bad passwords
    regex      : /Auth: \[.*?\] user \[.*?\]\\\[(.*?)\] .*? status \[NT_STATUS_(?!OK).*?\] .*? remote host \[ipv4:([0-9.]+):.*\]/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  {
    event_type : 'SMB_FAILED',
    // Fallback for NT_STATUS_ACCESS_DENIED without Auth line
    regex      : /create_connection_session_info: user '([^']+)' .*? denied/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: null }), // We might not have IP on this specific line, but it's a fallback
  },
];

function parseLine(line) {
  for (const pattern of PATTERNS) {
    const match = line.match(pattern.regex);
    if (match) {
      return {
        event_type: pattern.event_type,
        raw_log   : line.trimEnd(),
        ...pattern.extract(match),
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 5. GEOIP MODULE
// ─────────────────────────────────────────────
function enrichWithGeo(event) {
  const geo = geoip.lookup(event.ip_address);
  if (!geo) {
    return { ...event, country: null, city: null, latitude: null, longitude: null };
  }
  return {
    ...event,
    country  : geo.country   || null,
    city     : geo.city      || null,
    latitude : geo.ll ? geo.ll[0] : null,
    longitude: geo.ll ? geo.ll[1] : null,
  };
}

// ─────────────────────────────────────────────
// 6. LOG COLLECTOR MODULE
// ─────────────────────────────────────────────
/**
 * Generic file tail watcher — used for XRDP, FTP, and any extra log sources.
 * Silently skips if the log file doesn't exist on this system.
 */
function startFileWatcher(filePath, label) {
  const child = spawn('tail', ['-f', '-n', '0', filePath]);

  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    const parsed = parseLine(line);
    if (!parsed) return;
    const enriched = enrichWithGeo(parsed);
    await insertEvent(enriched);
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('No such file')) {
      console.warn(`[${label}] stderr: ${msg}`);
    }
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.warn(`[${label}] Watcher exited (code ${code}). Retrying in 30s...`);
      setTimeout(() => startFileWatcher(filePath, label), 30000);
    }
  });

  child.on('error', (err) => {
    // Log file may not exist on this system — suppress and retry quietly
    console.warn(`[${label}] Could not tail ${filePath} (${err.message}). Retrying in 60s...`);
    setTimeout(() => startFileWatcher(filePath, label), 60000);
  });
}

function startCollector() {
  // ── Primary SSH / auth log ───────────────────────────────────────────────
  if (config.logSource === 'auth') {
    console.log('[Collector] Starting: tail -f /var/log/auth.log');
    const child = spawn('tail', ['-f', '-n', '0', '/var/log/auth.log']);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      const parsed = parseLine(line);
      if (!parsed) return;
      const enriched = enrichWithGeo(parsed);
      await insertEvent(enriched);
    });
    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.warn(`[Collector] stderr: ${msg}`);
    });
    child.on('close', (code) => {
      console.warn(`[Collector] Process exited (code ${code}). Restarting in 5s...`);
      setTimeout(startCollector, 5000);
    });
    child.on('error', (err) => {
      console.error(`[Collector] Failed to start: ${err.message}`);
      setTimeout(startCollector, 10000);
    });
  } else {
    console.log('[Collector] Starting: journalctl -u ssh -f');
    const child = spawn('journalctl', ['-u', 'ssh', '-f', '-n', '0', '--output=cat']);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      const parsed = parseLine(line);
      if (!parsed) return;
      const enriched = enrichWithGeo(parsed);
      await insertEvent(enriched);
    });
    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.warn(`[Collector] stderr: ${msg}`);
    });
    child.on('close', (code) => {
      console.warn(`[Collector] Process exited (code ${code}). Restarting in 5s...`);
      setTimeout(startCollector, 5000);
    });
    child.on('error', (err) => {
      console.error(`[Collector] Failed to start: ${err.message}`);
      setTimeout(startCollector, 10000);
    });
  }

  // ── Extra log sources (XRDP, FTP/SFTP) ───────────────────────────────────
  startFileWatcher('/var/log/xrdp-sesman.log', 'XRDP');
  startFileWatcher('/var/log/vsftpd.log',      'FTP');
  startFileWatcher('/var/log/proftpd/proftpd.log', 'ProFTPD');
  startFileWatcher('/var/log/samba/log.smbd',  'SMB');
}

// ─────────────────────────────────────────────
// 7. UTILITY
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// 8. MAIN ENTRYPOINT & GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  SOC Radar - Phase 1 Log Collector   ║');
  console.log('║  (Phase 2 Gateway notifications ON)  ║');
  console.log('╚══════════════════════════════════════╝');

  await createPool();
  startCollector();

  console.log('[Main] Collector is running. Press Ctrl+C to stop.');
  console.log(`[Main] Gateway notify URL: ${config.gatewayUrl}`);
}

async function shutdown(signal) {
  console.log(`\n[Main] Received ${signal}. Shutting down...`);
  if (pool) {
    await pool.end();
    console.log('[DB] Pool closed.');
  }
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason);
});

main().catch((err) => {
  console.error('[Fatal] Startup failed:', err.message);
  process.exit(1);
});
