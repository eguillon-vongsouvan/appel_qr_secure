/**
 * Génère un QR code en PNG pour un élève.
 * Usage : node scripts/generate-qr.js NomEleve PrenomEleve [port]
 * Exemple : node scripts/generate-qr.js Dupont Jean
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
require('../lib/load-env').loadEnvFile();
const { getBaseUrl } = require('../lib/base-url');

const [nom, prenom, portArg] = process.argv.slice(2);
const PORT = portArg || process.env.PORT || 3000;

if (!nom || !prenom) {
  console.error('Usage : npm run qr -- NomEleve PrenomEleve');
  console.error('   ou : node scripts/generate-qr.js NomEleve PrenomEleve');
  process.exit(1);
}

const { buildStudentToken } = require('../lib/qr-token');
const nonceStore = require('../lib/nonce-store');
const { slot, sig, nonce } = buildStudentToken(nom, prenom);
nonceStore.issue(nonce, slot);
const params = new URLSearchParams({
  nom,
  prenom,
  t: String(slot),
  n: nonce,
  sig,
});
const url = `${getBaseUrl(PORT)}/presence?${params.toString()}`;
console.warn('Attention : ce PNG est figé ~30 s. Pour la classe, utilisez /affiche dans le navigateur.');
const outDir = path.join(__dirname, '..', 'qr-codes');
const filename = `${nom}_${prenom}.png`.replace(/[^\w.-]/g, '_');
const outPath = path.join(outDir, filename);

fs.mkdirSync(outDir, { recursive: true });

QRCode.toFile(outPath, url, { width: 400, margin: 2 }, (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log('QR code généré :', outPath);
  console.log('URL encodée   :', url);
});
