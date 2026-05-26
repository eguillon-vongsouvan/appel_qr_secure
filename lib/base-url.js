/**
 * URL publique obligatoire — pas de mode local (IP / localhost).
 */

function stripTrailingSlash(url) {
  return String(url).replace(/\/$/, '');
}

function getConfiguredPublicUrl() {
  if (process.env.PUBLIC_URL) {
    return stripTrailingSlash(process.env.PUBLIC_URL);
  }
  if (process.env.PUBLIC_BASE_URL) {
    return stripTrailingSlash(process.env.PUBLIC_BASE_URL);
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return stripTrailingSlash(process.env.RENDER_EXTERNAL_URL);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${stripTrailingSlash(process.env.RAILWAY_PUBLIC_DOMAIN)}`;
  }
  return null;
}

function isLocalHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return true;
  }
  return false;
}

function isPublicMode() {
  const url = getConfiguredPublicUrl();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return !isLocalHost(host);
  } catch {
    return false;
  }
}

/** Quitte le processus si aucune URL Internet valide n'est configurée. */
function requireOnlineMode() {
  const url = getConfiguredPublicUrl();
  if (!url) {
    console.error('');
    console.error('  ERREUR : mode en ligne obligatoire.');
    console.error('  Ajoutez dans le fichier .env :');
    console.error('    PUBLIC_URL=https://votre-app.onrender.com');
    console.error('  Ou avec ngrok :');
    console.error('    PUBLIC_URL=https://xxxx.ngrok-free.app');
    console.error('');
    console.error('  Voir scripts\\tunnel-ngrok.ps1 ou déployez sur Render.');
    console.error('');
    process.exit(1);
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error('');
    console.error('  ERREUR : PUBLIC_URL invalide :', url);
    process.exit(1);
  }
  if (isLocalHost(host)) {
    console.error('');
    console.error('  ERREUR : URL locale interdite (' + host + ').');
    console.error('  Utilisez une URL Internet (https://…), pas 127.0.0.1 ni 192.168.x.x');
    console.error('');
    process.exit(1);
  }
  return url;
}

/** URL de base pour les QR codes (toujours publique). */
function getBaseUrl() {
  return requireOnlineMode();
}

module.exports = {
  getBaseUrl,
  getConfiguredPublicUrl,
  isPublicMode,
  requireOnlineMode,
  isLocalHost,
};
