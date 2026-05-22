/**
 * Émargement par QR — local (Wi-Fi) ou Internet (PUBLIC_URL).
 */
const express = require('express');
const QRCode = require('qrcode');
const { getAllLocalIps } = require('./lib/get-local-ip');
const { getBaseUrl, isPublicMode } = require('./lib/base-url');
const {
  buildStudentToken,
  buildSessionToken,
  verifyStudentQuery,
  verifySessionQuery,
  secondsUntilNextWindow,
  WINDOW_MS,
} = require('./lib/qr-token');
const { escapeHtml, errorPage, presenceSuccessPage } = require('./lib/html');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const from = req.socket.remoteAddress || '?';
  console.log(`[HTTP] ${from} ${req.method} ${req.originalUrl}`);
  next();
});

const PORT = process.env.PORT || 3000;
const allIps = getAllLocalIps();
const publicMode = isPublicMode();

function baseUrl() {
  return getBaseUrl(PORT);
}

/** URL de présence signée (valide ~30 s, marge 30 s supplémentaire). */
function presenceUrl(nom, prenom) {
  const { slot, sig } = buildStudentToken(nom, prenom);
  const params = new URLSearchParams({
    nom: String(nom),
    prenom: String(prenom),
    t: String(slot),
    sig,
  });
  return `${baseUrl()}/presence?${params.toString()}`;
}

/** URL d'émargement via QR de séance (affiche classe). */
function sessionScanUrl() {
  const { slot, sig } = buildSessionToken();
  const params = new URLSearchParams({ t: String(slot), sig });
  return `${baseUrl()}/emarger?${params.toString()}`;
}

function phoneTestLinksHtml() {
  if (publicMode) {
    const u = baseUrl();
    return `<p class="ok-public">Mode Internet actif</p>
      <p>Test : <a href="${escapeHtml(u)}/test">${escapeHtml(u)}/test</a></p>`;
  }
  if (allIps.length === 0) {
    return '<p class="warn">Aucune IP locale. Utilisez PUBLIC_URL pour Internet.</p>';
  }
  return `<ul>${allIps
    .map(
      (c) =>
        `<li><strong>${escapeHtml(c.name)}</strong> — <a href="http://${escapeHtml(c.address)}:${PORT}/test">http://${escapeHtml(c.address)}:${PORT}/test</a></li>`
    )
    .join('')}</ul>`;
}

// ——— Accueil ———
app.get('/', (req, res) => {
  const phoneUrl = baseUrl();
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Émargement QR</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      max-width: 36rem;
      margin: 2rem auto;
      padding: 0 1rem 2rem;
      color: #1a1a2e;
      line-height: 1.5;
    }
    h1 { font-size: 1.35rem; }
    .ip {
      background: #e8f4fd;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-family: monospace;
      word-break: break-all;
      font-size: 0.9rem;
    }
    .box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem;
      margin: 1rem 0;
    }
    .box h2 { font-size: 1rem; margin: 0 0 0.5rem; }
    .box ol { margin: 0.5rem 0 0; padding-left: 1.2rem; }
    .box li { margin: 0.35rem 0; }
    label { display: block; margin-top: 1rem; font-weight: 600; }
    input {
      width: 100%;
      padding: 0.6rem;
      margin-top: 0.25rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 1rem;
    }
    .btn {
      display: inline-block;
      margin-top: 0.75rem;
      padding: 0.7rem 1rem;
      background: #2563eb;
      color: #fff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      width: 100%;
      text-align: center;
    }
    .btn.green { background: #16a34a; }
    .btn:hover { filter: brightness(1.05); }
    .warn { color: #b45309; font-size: 0.9rem; }
    .ok-public { color: #166534; font-weight: 600; }
    .links { margin-top: 1rem; }
    .links a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Émargement par QR Code</h1>

  <div class="box">
    <h2>${publicMode ? 'Accès Internet (PUBLIC_URL)' : 'Accès téléphone (même Wi-Fi)'}</h2>
    ${phoneTestLinksHtml()}
    <p class="ip">URL dans les QR : ${escapeHtml(phoneUrl)}</p>
    ${publicMode ? '' : `<ol>
      <li>Même Wi-Fi PC / téléphone</li>
      <li>Pare-feu : <code>scripts\\parefeu.ps1</code> (admin)</li>
      <li>Pour Internet : définir <code>PUBLIC_URL</code> (voir ci-dessous)</li>
    </ol>`}
  </div>

  <div class="box">
    <h2>Passer sur Internet</h2>
    <p>Définissez l'URL publique avant <code>npm start</code> :</p>
    <p class="ip">set PUBLIC_URL=https://votre-url.ngrok-free.app</p>
    <p>Ou déployez sur <strong>Render</strong> (gratuit) — le fichier <code>render.yaml</code> est prêt.</p>
  </div>

  <div class="box">
    <h2>Mode classe (recommandé)</h2>
    <p>QR unique qui change toutes les 30 s — à projeter ou afficher sur un écran.</p>
    <a class="btn green" href="/affiche">Ouvrir le QR de séance</a>
  </div>

  <div class="box">
    <h2>QR par élève (écran dédié)</h2>
    <form action="/qr" method="get">
      <label for="nom">Nom</label>
      <input id="nom" name="nom" required placeholder="Dupont">
      <label for="prenom">Prénom</label>
      <input id="prenom" name="prenom" required placeholder="Marie">
      <button type="submit" class="btn">Afficher le QR (30 s)</button>
    </form>
  </div>

  <p class="links"><a href="/diagnostic">Diagnostic</a> · <a href="/aide">Aide</a></p>
</body>
</html>`);
});

app.get('/diagnostic', (req, res) => {
  const client = req.socket.remoteAddress || '';
  res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnostic</title>
<style>body{font-family:system-ui;max-width:34rem;margin:1rem auto;padding:0 1rem}
.ok{color:#166534}.bad{color:#b91c1c}code{background:#f1f5f9;padding:.2rem .4rem;border-radius:4px;word-break:break-all}
li{margin:.5rem 0}</style></head><body>
<h1>Diagnostic serveur</h1>
<p class="ok">✓ Serveur actif sur le port <strong>${PORT}</strong></p>
<p>Votre appareil : <code>${escapeHtml(client)}</code></p>
<p>Heure serveur : ${new Date().toLocaleString('fr-FR')}</p>
<h2>Adresses pour le téléphone</h2>
${phoneTestLinksHtml()}
<h2>Commandes utiles (PC)</h2>
<pre>npm run stop
npm start</pre>
<p><a href="/affiche">QR de séance</a> · <a href="/">Accueil</a></p>
</body></html>`);
});

// ——— Test connexion téléphone ———
app.get('/test', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test connexion</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1.5rem;
      background: #ecfdf5;
      color: #166534;
    }
    .ok { font-size: 3rem; }
  </style>
</head>
<body>
  <div>
    <p class="ok">✓</p>
    <h1>Connexion OK</h1>
    <p>Votre téléphone atteint bien le serveur du PC.</p>
    <p>Vous pouvez scanner le QR d'émargement.</p>
  </div>
</body>
</html>`);
});

app.get('/aide', (req, res) => {
  const u = baseUrl();
  res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aide téléphone</title>
<style>body{font-family:system-ui;max-width:32rem;margin:1.5rem auto;padding:0 1rem;line-height:1.6}
code{background:#f1f5f9;padding:.15rem .4rem;border-radius:4px;word-break:break-all}</style></head>
<body>
<h1>Comment le téléphone accède au serveur</h1>
<p>Le QR code contient une URL avec l'<strong>IP du PC</strong>, par exemple :</p>
<p><code>${escapeHtml(u)}/emarger?...</code></p>
<p>Quand vous scannez, l'appareil photo ouvre cette URL dans le navigateur du téléphone. Le téléphone contacte le PC sur le Wi-Fi — comme un site web local.</p>
<h2>Checklist</h2>
<ul>
<li>Serveur lancé : <code>npm start</code></li>
<li>Même Wi-Fi PC / téléphone</li>
<li>Pas de VPN isolant le téléphone</li>
<li>Pare-feu : autoriser Node.js sur réseau privé</li>
<li>Test : ouvrir <code>${escapeHtml(u)}/test</code> sur le téléphone</li>
</ul>
<p><a href="/">← Retour</a></p>
</body></html>`);
});

// ——— Affiche classe : QR séance, rafraîchi toutes les 30 s ———
app.get('/affiche', (req, res) => {
  const url = sessionScanUrl();
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QR séance — émargement</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      text-align: center;
      padding: 1.5rem;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100dvh;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .sub { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem; }
    #qr { max-width: min(90vw, 360px); background: #fff; padding: 12px; border-radius: 12px; }
    .timer {
      margin-top: 1rem;
      font-size: 1.1rem;
      font-variant-numeric: tabular-nums;
    }
    .timer span { color: #4ade80; font-weight: 700; }
    .hint { margin-top: 1rem; font-size: 0.8rem; color: #64748b; max-width: 24rem; margin-left: auto; margin-right: auto; }
    .phone { font-family: monospace; font-size: 0.75rem; color: #38bdf8; word-break: break-all; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Scannez pour émarger</h1>
  <p class="sub">QR renouvelé toutes les 30 secondes</p>
  <img id="qr" alt="QR code séance" width="320" height="320">
  <p class="timer">Prochain QR dans <span id="sec">30</span> s</p>
  <p class="hint">Scannez vite : l'ancien QR expire. Même Wi-Fi que ce PC.</p>
  <p class="phone">${escapeHtml(baseUrl())}</p>
  <script>
    const img = document.getElementById('qr');
    const secEl = document.getElementById('sec');
    const WINDOW = ${WINDOW_MS};

    function refreshQr() {
      img.src = '/qr-session.png?_=' + Date.now();
    }

    function updateCountdown() {
      const left = Math.ceil((WINDOW - (Date.now() % WINDOW)) / 1000);
      secEl.textContent = left;
      if (left <= 1) refreshQr();
    }

    refreshQr();
    setInterval(refreshQr, WINDOW);
    setInterval(updateCountdown, 250);
    updateCountdown();
  </script>
</body>
</html>`);
});

// ——— PNG QR séance (créneau courant) ———
app.get('/qr-session.png', async (req, res) => {
  try {
    const url = sessionScanUrl();
    res.type('png');
    res.set('Cache-Control', 'no-store');
    await QRCode.toFileStream(res, url, { width: 400, margin: 2 });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ——— Après scan du QR séance : formulaire nom / prénom ———
app.get('/emarger', (req, res) => {
  const { t, sig } = req.query;
  if (!verifySessionQuery(t, sig)) {
    return res
      .status(410)
      .send(
        errorPage(
          'QR expiré',
          'Ce QR a plus de 30 secondes. Rescannez le code affiché à l\'écran.'
        )
      );
  }

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Émarger</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      max-width: 22rem;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      min-height: 100dvh;
      background: #f0fdf4;
    }
    h1 { font-size: 1.2rem; color: #166534; }
    label { display: block; margin-top: 1rem; font-weight: 600; }
    input {
      width: 100%;
      padding: 0.75rem;
      margin-top: 0.35rem;
      border: 1px solid #86efac;
      border-radius: 8px;
      font-size: 1.05rem;
    }
    button {
      width: 100%;
      margin-top: 1.25rem;
      padding: 0.85rem;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1.05rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>Validation de présence</h1>
  <p>Indiquez votre identité :</p>
  <form method="post" action="/emarger">
    <input type="hidden" name="t" value="${escapeHtml(t)}">
    <input type="hidden" name="sig" value="${escapeHtml(sig)}">
    <label for="prenom">Prénom</label>
    <input id="prenom" name="prenom" required autocomplete="given-name">
    <label for="nom">Nom</label>
    <input id="nom" name="nom" required autocomplete="family-name">
    <button type="submit">Confirmer ma présence</button>
  </form>
</body>
</html>`);
});

app.post('/emarger', (req, res) => {
  const { t, sig, nom, prenom } = req.body;
  const n = (nom || '').trim();
  const p = (prenom || '').trim();

  if (!verifySessionQuery(t, sig)) {
    return res
      .status(410)
      .send(
        errorPage(
          'Session expirée',
          'Le délai est dépassé. Rescannez le QR affiché (il change toutes les 30 s).'
        )
      );
  }
  if (!n || !p) {
    return res.status(400).send(errorPage('Erreur', 'Nom et prénom requis.'));
  }

  console.log(`[PRÉSENCE] ${p} ${n} — ${new Date().toISOString()}`);
  res.send(presenceSuccessPage(p, n));
});

// ——— QR par élève (page avec rafraîchissement 30 s) ———
app.get('/qr', (req, res) => {
  const { nom, prenom } = req.query;
  if (!nom || !prenom) {
    return res.status(400).send('Paramètres : ?nom=...&prenom=...');
  }

  const n = escapeHtml(nom);
  const p = escapeHtml(prenom);

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QR — ${p} ${n}</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 1.5rem; }
    img { max-width: 100%; background: #fff; padding: 8px; border-radius: 8px; }
    .timer { margin-top: 1rem; font-variant-numeric: tabular-nums; }
    .timer span { color: #16a34a; font-weight: 700; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${p} ${n}</h1>
  <p>QR valide 30 s — rescannez si expiré</p>
  <img id="qr" alt="QR présence" width="320" height="320">
  <p class="timer">Prochain QR dans <span id="sec">30</span> s</p>
  <p><a href="/">← Retour</a></p>
  <script>
    const nom = ${JSON.stringify(String(nom))};
    const prenom = ${JSON.stringify(String(prenom))};
    const img = document.getElementById('qr');
    const secEl = document.getElementById('sec');
    const WINDOW = ${WINDOW_MS};

    function refreshQr() {
      img.src = '/qr.png?nom=' + encodeURIComponent(nom) +
        '&prenom=' + encodeURIComponent(prenom) + '&_=' + Date.now();
    }
    function updateCountdown() {
      const left = Math.ceil((WINDOW - (Date.now() % WINDOW)) / 1000);
      secEl.textContent = left;
      if (left <= 1) refreshQr();
    }
    refreshQr();
    setInterval(refreshQr, WINDOW);
    setInterval(updateCountdown, 250);
    updateCountdown();
  </script>
</body>
</html>`);
});

// ——— PNG QR élève (créneau courant) ———
app.get('/qr.png', async (req, res) => {
  const { nom, prenom } = req.query;
  if (!nom || !prenom) {
    return res.status(400).send('Paramètres : nom, prenom');
  }
  try {
    const url = presenceUrl(nom, prenom);
    res.type('png');
    res.set('Cache-Control', 'no-store');
    await QRCode.toFileStream(res, url, { width: 400, margin: 2 });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ——— Validation directe par scan (QR élève) ———
app.get('/presence', (req, res) => {
  const nom = (req.query.nom || '').trim();
  const prenom = (req.query.prenom || '').trim();
  const { t, sig } = req.query;

  if (!nom || !prenom) {
    return res
      .status(400)
      .send(errorPage('Lien invalide', 'Nom et prénom manquants.'));
  }

  if (!verifyStudentQuery(nom, prenom, t, sig)) {
    return res
      .status(410)
      .send(
        errorPage(
          'QR expiré',
          'Ce code a plus de 30 secondes. Demandez un nouveau QR à l\'écran.'
        )
      );
  }

  console.log(`[PRÉSENCE] ${prenom} ${nom} — ${new Date().toISOString()}`);
  res.send(presenceSuccessPage(prenom, nom));
});

// ——— Démarrage ———
const server = app.listen(PORT, '0.0.0.0', () => {
  const sec = secondsUntilNextWindow();
  const url = baseUrl();
  console.log('');
  console.log('  Émargement QR — serveur démarré');
  console.log('  ─────────────────────────────────');
  if (publicMode) {
    console.log(`  Mode             : INTERNET (PUBLIC_URL)`);
    console.log(`  URL publique     : ${url}`);
    console.log(`  QR / affiche     : ${url}/affiche`);
    console.log(`  Test             : ${url}/test`);
  } else {
    console.log(`  Mode             : LOCAL (Wi-Fi)`);
    console.log(`  PC               : http://localhost:${PORT}/affiche`);
    for (const c of allIps) {
      console.log(`  Téléphone (${c.name}) : http://${c.address}:${PORT}/test`);
    }
    console.log('');
    console.log('  Internet ?  set PUBLIC_URL=https://votre-url  puis npm start');
  }
  console.log('');
  console.log('  Port bloqué ?  npm run stop');
  console.log(`  QR : toutes les ${WINDOW_MS / 1000} s (prochain dans ${sec} s)`);
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  ERREUR : le port ${PORT} est déjà utilisé.`);
    console.error('  Tapez :  npm run stop');
    console.error('  Puis :   npm start');
    console.error('');
    process.exit(1);
  }
  throw err;
});
