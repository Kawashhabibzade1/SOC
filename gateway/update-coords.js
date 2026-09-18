require('dotenv').config({ path: '/home/kawash/soc-collector/.env' });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [res1] = await conn.execute(
    "UPDATE security_events SET country = 'Tailscale VPN', city = 'Gateway Node', latitude = 50.1109, longitude = 8.6821 WHERE ip_address LIKE '100.%'"
  );
  const [res2] = await conn.execute(
    "UPDATE security_events SET country = 'Local Network', city = 'Localhost', latitude = 50.1109, longitude = 8.6821 WHERE ip_address = '127.0.0.1'"
  );

  // Insert a few realistic public attacks so the 3D globe has worldwide attack paths
  const samples = [
    { type: 'SSH_FAILED', ip: '185.220.101.5', user: 'root', country: 'Germany', city: 'Frankfurt', lat: 50.1155, lon: 8.6842 },
    { type: 'SSH_FAILED', ip: '45.154.255.88', user: 'admin', country: 'Russia', city: 'Moscow', lat: 55.7558, lon: 37.6173 },
    { type: 'FAIL2BAN_BLOCK', ip: '112.85.42.103', user: null, country: 'China', city: 'Nanjing', lat: 32.0617, lon: 118.7632 },
    { type: 'SSH_FAILED', ip: '198.235.24.12', user: 'ubuntu', country: 'United States', city: 'Ashburn', lat: 39.0438, lon: -77.4874 },
    { type: 'FAIL2BAN_BLOCK', ip: '177.54.144.18', user: null, country: 'Brazil', city: 'Sao Paulo', lat: -23.5505, lon: -46.6333 },
    { type: 'SSH_FAILED', ip: '103.152.220.45', user: 'test', country: 'India', city: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  ];

  for (const s of samples) {
    await conn.execute(
      "INSERT INTO security_events (timestamp, event_type, ip_address, targeted_user, country, city, latitude, longitude, raw_log) VALUES (NOW(3), ?, ?, ?, ?, ?, ?, ?, ?)",
      [s.type, s.ip, s.user, s.country, s.city, s.lat, s.lon, `Sample attack from ${s.ip}`]
    );
  }

  console.log(`Updated existing: Tailscale (${res1.affectedRows}), Local (${res2.affectedRows}). Added ${samples.length} worldwide sample threats.`);
  await conn.end();
}

run().catch(console.error);
