const crypto = require('crypto');

const WINDOW_MS = 30_000;

/** Secret partagé pour signer les fenêtres de 30 s (variable d'environnement recommandée). */
function getSecret() {
  return process.env.QR_SECRET || 'appel-qr-dev-changez-moi';
}

function currentSlot(now = Date.now()) {
  return Math.floor(now / WINDOW_MS);
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16);
}

/** Jeton pour un élève : nom + prénom + créneau de 30 s. */
function buildStudentToken(nom, prenom, slot = currentSlot()) {
  const payload = `eleve|${nom}|${prenom}|${slot}`;
  return { slot, sig: signPayload(payload) };
}

/** Jeton pour la séance (QR unique affiché en classe). */
function buildSessionToken(slot = currentSlot()) {
  const payload = `session|${slot}`;
  return { slot, sig: signPayload(payload) };
}

function safeEqualHex(expected, given) {
  const a = String(given);
  if (a.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(a));
}

function verifyStudentToken(nom, prenom, slot, sig) {
  if (!nom || !prenom || slot === undefined || !sig) return false;
  const s = Number(slot);
  if (!Number.isFinite(s)) return false;
  return safeEqualHex(
    signPayload(`eleve|${nom}|${prenom}|${s}`),
    String(sig)
  );
}

function verifySessionToken(slot, sig) {
  if (slot === undefined || !sig) return false;
  const s = Number(slot);
  if (!Number.isFinite(s)) return false;
  return safeEqualHex(signPayload(`session|${s}`), String(sig));
}

/** Accepte créneau courant ±2 (jusqu'à ~90 s) pour laisser le temps au scan. */
function isSlotValid(slot, now = Date.now()) {
  const s = Number(slot);
  const cur = currentSlot(now);
  return s >= cur - 2 && s <= cur + 1;
}

function verifyStudentQuery(nom, prenom, slot, sig, now = Date.now()) {
  return (
    isSlotValid(slot, now) &&
    verifyStudentToken(nom, prenom, Number(slot), sig)
  );
}

function verifySessionQuery(slot, sig, now = Date.now()) {
  return (
    isSlotValid(slot, now) &&
    verifySessionToken(Number(slot), sig)
  );
}

function secondsUntilNextWindow(now = Date.now()) {
  const elapsed = now % WINDOW_MS;
  return Math.ceil((WINDOW_MS - elapsed) / 1000);
}

module.exports = {
  WINDOW_MS,
  currentSlot,
  buildStudentToken,
  buildSessionToken,
  verifyStudentQuery,
  verifySessionQuery,
  secondsUntilNextWindow,
};
