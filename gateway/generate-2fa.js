const { generateSecret, generateURI } = require('otplib');
const qrcode = require('qrcode');

// Generate a random base32 secret
const secret = generateSecret();
const user = 'admin';
const service = 'SOC Radar';

// Generate the otpauth:// URI
const otpauth = generateURI({ secret, label: user, issuer: service });

console.log('----------------------------------------------------');
console.log('SOC RADAR - 2FA SETUP');
console.log('----------------------------------------------------');
console.log('1. Add this secret to your .env file in the gateway folder:');
console.log(`   TOTP_SECRET=${secret}`);
console.log('   ADMIN_USERNAME=admin');
console.log('   ADMIN_PASSWORD=soc-radar-2026\n');
console.log('2. Scan the QR code below using Microsoft Authenticator:\n');

qrcode.toString(otpauth, { type: 'terminal', small: true }, (err, url) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(url);
  console.log('If the QR code is distorted in your terminal, use this secret key manually:');
  console.log(`Key: ${secret}`);
  console.log('Type: Time-based (TOTP)');
  console.log('----------------------------------------------------');
});
