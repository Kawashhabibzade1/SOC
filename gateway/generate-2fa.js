const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// Generate a random base32 secret
const secret = authenticator.generateSecret();
const user = 'admin';
const service = 'SOC Radar';

// Generate the otpauth:// URI
const otpauth = authenticator.keyuri(user, service, secret);

console.log('----------------------------------------------------');
console.log('SOC RADAR - 2FA SETUP');
console.log('----------------------------------------------------');
console.log('1. Add this secret to your .env file in the gateway folder:');
console.log(`   TOTP_SECRET=${secret}`);
console.log('   ADMIN_USERNAME=admin');
console.log('   ADMIN_PASSWORD=soc-radar-2026\n');
console.log('2. Scan the QR code below using Microsoft Authenticator:');

qrcode.toString(otpauth, { type: 'terminal' }, (err, url) => {
  if (err) throw err;
  console.log(url);
  console.log('----------------------------------------------------');
});
