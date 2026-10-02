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
const { spawn, execSync } = require('child_process');
const readline  = require('readline');
const mysql     = require('mysql2/promise');
const geoip     = require('geoip-lite');
const fs        = require('fs');

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
  // New format: [INFO ] AUTHFAIL: user=hacked ip=::ffff:100.119.82.94 time=...
  {
    event_type : 'XRDP_FAILED',
    regex      : /AUTHFAIL: user=(\S+)\s+ip=(?:::ffff:)?([\d.]+)/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // New format: [INFO ] Access permitted for user: kawash
  // Combined with IP from: Received system login request from xrdp for user: kawash IP: ::ffff:100.119.82.94
  {
    event_type : 'XRDP_SUCCESS',
    regex      : /Received system login request from xrdp for user:\s+(\S+)\s+IP:\s+(?:::ffff:)?([\d.]+)/i,
    extract    : (m) => ({ targeted_user: m[1], ip_address: m[2] }),
  },
  // Legacy XRDP patterns (keep as fallback)
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
let tailscaleNodes = {};
let serverGeo = { latitude: 51.1657, longitude: 10.4515, country: 'DE', city: 'Heimserver' };

// Get server's actual public IP on startup to anchor Tailscale nodes
const https = require('https');
https.get('https://api.ipify.org', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const geo = geoip.lookup(data.trim());
    if (geo && geo.ll) {
      serverGeo.latitude = geo.ll[0];
      serverGeo.longitude = geo.ll[1];
      serverGeo.country = geo.country;
      serverGeo.city = geo.city || 'Heimserver';
    }
  });
}).on('error', () => {});

async function updateTailscaleMap() {
  const { exec } = require('child_process');
  exec('tailscale status --json', (err, stdout) => {
    if (!err && stdout) {
      try {
        const status = JSON.parse(stdout);
        let newNodes = {};
        for (const key in status.Peer) {
          const peer = status.Peer[key];
          for (const ip of peer.TailscaleIPs || []) {
            newNodes[ip] = peer.HostName || peer.DNSName?.split('.')[0] || 'Tailscale Device';
          }
        }
        // Include self as well
        if (status.Self) {
          for (const ip of status.Self.TailscaleIPs || []) {
            newNodes[ip] = status.Self.HostName || 'Heimserver';
          }
        }
        tailscaleNodes = newNodes;
      } catch (e) {
        console.error('[Tailscale] Failed to parse JSON:', e.message);
      }
    }
  });
}
setInterval(updateTailscaleMap, 60000);
updateTailscaleMap();

function enrichWithGeo(event) {
  let ip = event.ip_address;
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  // 1. Check if it's a Tailscale device
  if (ip && tailscaleNodes[ip]) {
    // Add deterministic slight offset so multiple devices don't perfectly overlap on the globe
    const offset = (parseInt(ip.split('.')[3]) || 0) * 0.05;
    return {
      ...event,
      country  : 'Tailscale',
      city     : tailscaleNodes[ip],
      latitude : serverGeo.latitude + offset,
      longitude: serverGeo.longitude + offset,
    };
  }

  // 2. Regular GeoIP lookup
  const geo = geoip.lookup(ip);
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
 * Generic file tail watcher — used for FTP and any extra log sources.
 * Silently skips if the log file doesn't exist on this system.
 * Uses inotify — if the OS watch limit is hit, use startJournalctlWatcher instead.
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
    console.warn(`[${label}] Could not tail ${filePath} (${err.message}). Retrying in 60s...`);
    setTimeout(() => startFileWatcher(filePath, label), 60000);
  });
}

/**
 * journalctl-based watcher — does NOT use inotify file watches.
 * Reads from the systemd journal for any service with a systemd unit.
 * Use this instead of startFileWatcher when inotify limits are hit.
 * @param {string} unit - systemd unit name (e.g. 'xrdp-sesman', 'smbd')
 * @param {string} label - Label for log messages
 */
function startJournalctlWatcher(unit, label) {
  console.log(`[${label}] Starting journalctl watcher for unit: ${unit}`);
  const child = spawn('journalctl', ['-u', unit, '-f', '-n', '0', '--output=cat']);

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
    if (msg) console.warn(`[${label}] stderr: ${msg}`);
  });

  child.on('close', (code) => {
    console.warn(`[${label}] journalctl exited (code ${code}). Retrying in 15s...`);
    setTimeout(() => startJournalctlWatcher(unit, label), 15000);
  });

  child.on('error', (err) => {
    console.warn(`[${label}] journalctl error (${err.message}). Retrying in 30s...`);
    setTimeout(() => startJournalctlWatcher(unit, label), 30000);
  });
}

// ─────────────────────────────────────────────
// Active Sessions Writer (for Docker gateway)
// Runs on the HOST so it can see real network connections.
// Writes to /tmp/soc_active_sessions.json which Docker gateway reads via volume mount.
// ─────────────────────────────────────────────
const SESSION_FILE = '/tmp/soc_active_sessions.json';

function updateActiveSessions() {
  try {
    const stdout = execSync('ss -tn state established 2>/dev/null', { timeout: 3000 }).toString();
    const lines = stdout.split('\n');
    const sessions = [];

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) return;
      const local = parts[2];
      const peer  = parts[3];
      if (!local || !peer || local === 'Local') return;

      const localMatch = local.match(/:(\d+)$/);
      const peerMatch  = peer.match(/^(\[[a-fA-F0-9:]+\]|[\d\.]+):/);
      if (!localMatch || !peerMatch) return;

      const localPort = parseInt(localMatch[1], 10);
      const peerIp    = peerMatch[1].replace(/\[|\]/g, '');

      let service = null;
      if (localPort === 22)   service = 'SSH / SFTP';
      else if (localPort === 21)   service = 'FTP';
      else if (localPort === 3389) service = 'XRDP';
      else if (localPort === 445)  service = 'SMB';

      if (!service || !peerIp) return;
      if (peerIp.startsWith('127.') || peerIp.startsWith('172.')) return;

      const exists = sessions.find(s => s.ip === peerIp && s.service === service);
      if (!exists) {
        const geo = geoip.lookup(peerIp);
        sessions.push({
          ip: peerIp,
          service,
          country  : geo ? geo.country : null,
          city     : geo ? geo.city    : null,
          latitude : geo && geo.ll ? geo.ll[0] : null,
          longitude: geo && geo.ll ? geo.ll[1] : null,
        });
      }
    });

    fs.writeFileSync(SESSION_FILE, JSON.stringify({ success: true, count: sessions.length, data: sessions, updatedAt: new Date().toISOString() }));
  } catch (err) {
    // ss may not be available — write empty result
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ success: true, count: 0, data: [], updatedAt: new Date().toISOString() }));
  }
}

// Update every 2 seconds
setInterval(updateActiveSessions, 2000);
updateActiveSessions();

// ─────────────────────────────────────────────
// Open Ports Writer (for Docker gateway)
// Runs on the HOST so it can see all open ports via ss -lntup.
// Writes to /tmp/soc_open_ports.json which Docker gateway reads via volume mount.
// ─────────────────────────────────────────────
const PORTS_FILE = '/tmp/soc_open_ports.json';
const PORT_APP_MAP = {
  22: { name: 'SSH / SFTP', icon: 'terminal', color: 'cyan' },
  80: { name: 'HTTP', icon: 'globe', color: 'blue' },
  443: { name: 'HTTPS', icon: 'lock', color: 'green' },
  3001: { name: 'SOC Gateway', icon: 'shield', color: 'purple' },
  3000: { name: 'SOC Frontend', icon: 'monitor', color: 'purple' },
  3306: { name: 'MariaDB', icon: 'database', color: 'orange' },
  3389: { name: 'XRDP (Remote Desktop)', icon: 'monitor', color: 'blue' },
  445: { name: 'Samba (SMB)', icon: 'folder', color: 'yellow' },
  139: { name: 'Samba (NetBIOS)', icon: 'folder', color: 'yellow' },
  8080: { name: 'Nextcloud', icon: 'cloud', color: 'blue' },
  8081: { name: 'Nextcloud (Alt)', icon: 'cloud', color: 'blue' },
  32400: { name: 'Plex Media Server', icon: 'film', color: 'yellow' },
  21: { name: 'FTP', icon: 'upload', color: 'orange' },
  25: { name: 'SMTP', icon: 'mail', color: 'red' },
  53: { name: 'DNS', icon: 'search', color: 'gray' },
};

function updateOpenPorts() {
  try {
    const stdout = execSync('ss -lntup 2>/dev/null', { timeout: 3000 }).toString();
    const dockerOut = execSync("docker ps --format '{{.Names}}|{{.Ports}}|{{.Image}}' 2>/dev/null", { timeout: 3000 }).toString();
    
    const dockerPortMap = {};
    dockerOut.split('\n').forEach(line => {
      if (!line.trim()) return;
      const [name, ports, image] = line.split('|');
      if (!ports) return;
      const portMatches = ports.matchAll(/(\d+\.\d+\.\d+\.\d+|0\.0\.0\.0)?:(\d+)->(\d+)\/(\w+)/g);
      for (const m of portMatches) {
        const hostPort = parseInt(m[2], 10);
        dockerPortMap[hostPort] = { docker: name, image: image?.split(':')[0]?.split('/')?.pop() || name };
      }
    });

    const lines = stdout.split('\n');
    const ports = [];

    lines.forEach(line => {
      if (!line.trim() || line.startsWith('Netid')) return;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) return;
      
      const proto = parts[0].toLowerCase();
      const localAddress = parts[4];
      const localPortMatch = localAddress.match(/:(\d+)$/);
      if (!localPortMatch) return;
      
      const portNum = parseInt(localPortMatch[1], 10);
      const address = localAddress.replace(/:(\d+)$/, '');
      
      let processName = null;
      const processMatch = line.match(/users:\(\("([^"]+)"/);
      if (processMatch) processName = processMatch[1];
      
      const appInfo = PORT_APP_MAP[portNum];
      const dockerInfo = dockerPortMap[portNum];
      
      let appName = processName;
      let appType = 'process';
      let appColor = 'slate';
      
      if (dockerInfo) {
        appName = `${dockerInfo.docker} (Docker)`;
        appType = 'docker';
        appColor = 'blue';
      } else if (appInfo) {
        appName = appInfo.name;
        appType = appInfo.icon;
        appColor = appInfo.color;
      } else if (processName) {
        appName = processName;
      } else {
        appName = 'Unknown';
      }
      
      const exists = ports.find(p => p.port === portNum && p.protocol === proto);
      if (!exists) {
        ports.push({
          protocol: proto,
          port: portNum,
          address,
          state: 'LISTEN',
          process: appName,
          appType,
          appColor,
          isDocker: !!dockerInfo,
          dockerName: dockerInfo ? dockerInfo.docker : null,
        });
      }
    });

    ports.sort((a, b) => a.port - b.port);
    fs.writeFileSync(PORTS_FILE, JSON.stringify({ success: true, count: ports.length, data: ports }));
  } catch (err) {
    fs.writeFileSync(PORTS_FILE, JSON.stringify({ success: true, count: 0, data: [] }));
  }
}

setInterval(updateOpenPorts, 5000);
updateOpenPorts();

// ─────────────────────────────────────────────
// Tailscale Mesh Status Writer
// ─────────────────────────────────────────────
const TAILSCALE_FILE = '/tmp/soc_tailscale.json';

function updateTailscaleStatus() {
  try {
    const stdout = execSync('tailscale status --json 2>/dev/null', { timeout: 3000 }).toString();
    const data = JSON.parse(stdout);
    fs.writeFileSync(TAILSCALE_FILE, JSON.stringify({ success: true, data }));
  } catch (err) {
    fs.writeFileSync(TAILSCALE_FILE, JSON.stringify({ success: false, data: null }));
  }
}

setInterval(updateTailscaleStatus, 10000);
updateTailscaleStatus();

// ─────────────────────────────────────────────
// Rogue Device Detection (LAN Monitor)
// ─────────────────────────────────────────────
const TRUSTED_MACS_FILE = path.join(__dirname, 'trusted_macs.json');
const LAN_DEVICES_FILE = '/tmp/soc_lan_devices.json';

function updateRogueDevices() {
  try {
    const stdout = execSync('ip neigh show').toString();
    const lines = stdout.split('\n');
    let trustedMacs = {};
    if (fs.existsSync(TRUSTED_MACS_FILE)) {
      trustedMacs = JSON.parse(fs.readFileSync(TRUSTED_MACS_FILE, 'utf8'));
    } else {
      // First run: auto-trust everything currently seen? 
      // For a honeypot logic, we should probably start empty and alert everything, or auto-trust 192.168.0.1 (router)
    }

    const currentDevices = [];
    lines.forEach(line => {
      const parts = line.trim().split(' ').filter(p => p);
      // Example: 192.168.0.132 dev wlp2s0 lladdr 6c:1f:f7:a2:48:60 REACHABLE
      if (parts.length >= 5 && parts[2] === 'lladdr') {
        const ip = parts[0];
        const mac = parts[3];
        if (mac.includes(':') && ip.includes('.')) {
          const isTrusted = !!trustedMacs[mac]?.trusted;
          currentDevices.push({ ip, mac, trusted: isTrusted, last_seen: Date.now() });

          if (!trustedMacs[mac]) {
            // New device! Alert it.
            console.warn(`[ROGUE] Unknown device detected: IP=${ip} MAC=${mac}`);
            trustedMacs[mac] = { trusted: false, first_seen: Date.now(), alerted: true, ip };
            
            // Log as SOC event
            const event = {
              event_type: 'UNKNOWN',
              ip_address: ip,
              targeted_user: `MAC: ${mac}`,
              raw_log: `[WARNING] Unknown/Rogue device detected on LAN: ${ip} (${mac})`
            };
            const enriched = enrichWithGeo(event);
            insertEvent(enriched);
          }
        }
      }
    });

    fs.writeFileSync(TRUSTED_MACS_FILE, JSON.stringify(trustedMacs, null, 2));
    fs.writeFileSync(LAN_DEVICES_FILE, JSON.stringify({ success: true, count: currentDevices.length, data: currentDevices }));
  } catch (err) {
    fs.writeFileSync(LAN_DEVICES_FILE, JSON.stringify({ success: false, data: [] }));
  }
}

setInterval(updateRogueDevices, 15000);
updateRogueDevices();

// ─────────────────────────────────────────────
// Network Traffic Monitor
// ─────────────────────────────────────────────
const TRAFFIC_FILE = '/tmp/soc_network_traffic.json';
let lastTrafficData = {};
let lastTrafficTime = Date.now();

function updateNetworkTraffic() {
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = raw.split('\n').slice(2); // Skip header
    const now = Date.now();
    const timeDiffSec = (now - lastTrafficTime) / 1000;
    
    let currentData = {};
    let interfaceStats = [];
    
    lines.forEach(line => {
      const parts = line.trim().split(/[\s:]+/);
      if (parts.length < 17) return;
      const iface = parts[0];
      const rxBytes = parseInt(parts[1], 10);
      const txBytes = parseInt(parts[9], 10);
      
      currentData[iface] = { rx: rxBytes, tx: txBytes };
      
      if (lastTrafficData[iface] && timeDiffSec > 0) {
        const rxSpeed = (rxBytes - lastTrafficData[iface].rx) / timeDiffSec; // Bytes/sec
        const txSpeed = (txBytes - lastTrafficData[iface].tx) / timeDiffSec;
        interfaceStats.push({ iface, rxSpeed, txSpeed, totalRx: rxBytes, totalTx: txBytes });
      }
    });
    
    lastTrafficData = currentData;
    lastTrafficTime = now;
    
    if (interfaceStats.length > 0) {
      fs.writeFileSync(TRAFFIC_FILE, JSON.stringify({ success: true, data: interfaceStats }));
    }
  } catch (err) {
    fs.writeFileSync(TRAFFIC_FILE, JSON.stringify({ success: false, data: [] }));
  }
}

setInterval(updateNetworkTraffic, 2000);
updateNetworkTraffic();

// ─────────────────────────────────────────────
// Honeypot (Active Defense Traps)
// ─────────────────────────────────────────────
const net = require('net');
const HONEYPOT_PORTS = [2323, 6379, 2121]; // Common attack ports (Telnet, Redis, FTP)

HONEYPOT_PORTS.forEach(port => {
  const server = net.createServer((socket) => {
    let ip = socket.remoteAddress || 'unknown';
    ip = ip.replace(/^.*:/, ''); // Strip IPv6 prefix if present

    console.warn(`[HONEYPOT] Trap triggered on port ${port} by ${ip}`);
    
    // Simulate fake response depending on port to waste attacker's time or gather info
    if (port === 2323) socket.write("Ubuntu 22.04 LTS\nlogin: ");
    else if (port === 6379) socket.write("-NOAUTH Authentication required.\r\n");
    else socket.write("220 ProFTPD Server (ProFTPD) [::ffff:192.168.0.193]\r\n");

    // We don't immediately destroy, let them hang for a bit
    setTimeout(() => socket.destroy(), 3000);

    // Trigger HONEYPOT_BREACH event
    const event = {
      event_type: 'HONEYPOT_BREACH',
      ip_address: ip,
      targeted_user: `port_${port}`,
      raw_log: `[HONEYPOT] Connection attempt to honeypot port ${port}`
    };
    const enriched = enrichWithGeo(event);
    insertEvent(enriched);
  });
  
  server.on('error', (err) => {
    console.error(`[HONEYPOT] Failed to start honeypot on port ${port}: ${err.message}`);
  });
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`[Honeypot] Trap armed on port ${port}`);
  });
});

// ─────────────────────────────────────────────
// Lockdown Watcher (Panic Button)
// ─────────────────────────────────────────────
const LOCKDOWN_FILE = '/tmp/soc_lockdown.trigger';
let isLockdownActive = false;

function applyLockdownRules(enable) {
  try {
    if (enable) {
      console.warn('[LOCKDOWN] ENGAGING COMPLETE NETWORK LOCKDOWN!');
      execSync('echo "0000" | sudo -S iptables -P INPUT DROP');
      execSync('echo "0000" | sudo -S iptables -A INPUT -i lo -j ACCEPT');
      execSync('echo "0000" | sudo -S iptables -A INPUT -i tailscale0 -j ACCEPT');
      execSync('echo "0000" | sudo -S iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT');
      execSync('echo "0000" | sudo -S iptables -A INPUT -p tcp --dport 22 -j ACCEPT');
    } else {
      console.log('[LOCKDOWN] RELEASING LOCKDOWN.');
      execSync('echo "0000" | sudo -S iptables -P INPUT ACCEPT');
      execSync('echo "0000" | sudo -S iptables -F INPUT');
    }
  } catch (err) {
    console.error(`[LOCKDOWN] Error applying iptables rules: ${err.message}`);
  }
}

function checkLockdownStatus() {
  const triggerExists = fs.existsSync(LOCKDOWN_FILE);
  if (triggerExists && !isLockdownActive) {
    isLockdownActive = true;
    applyLockdownRules(true);
  } else if (!triggerExists && isLockdownActive) {
    isLockdownActive = false;
    applyLockdownRules(false);
  }
}

setInterval(checkLockdownStatus, 2000);

function startCollector() {
  // ── Primary: journalctl -u ssh (covers SSH_FAILED, SSH_SUCCESS) ───────────
  console.log('[Collector] Starting: journalctl -t sshd -t sshd-session -f');
  const child = spawn('journalctl', ['-t', 'sshd', '-t', 'sshd-session', '-f', '-n', '0', '--output=cat']);
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    console.log(`[DEBUG SSH] ${line}`);
    const parsed = parseLine(line);
    if (!parsed) return;
    const enriched = enrichWithGeo(parsed);
    await insertEvent(enriched);
  });
  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.warn(`[SSH-Journalctl] stderr: ${msg}`);
  });
  child.on('close', (code) => {
    console.warn(`[SSH-Journalctl] Process exited (code ${code}). Restarting in 5s...`);
    setTimeout(startCollector, 5000);
  });
  child.on('error', (err) => {
    console.error(`[SSH-Journalctl] Failed to start: ${err.message}`);
    setTimeout(startCollector, 10000);
  });

  // ── Extra log sources (XRDP, FTP/SFTP, SMB) ───────────────────────────────
  // Use journalctl for all services (avoids inotify watch limit from Docker)
  startJournalctlWatcher('xrdp-sesman',  'XRDP');
  startJournalctlWatcher('smbd',         'SMB');
  startJournalctlWatcher('vsftpd',       'FTP');
  startJournalctlWatcher('proftpd',      'ProFTPD');
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
