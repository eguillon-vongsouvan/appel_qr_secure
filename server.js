/**
 * Émargement par QR — local (Wi-Fi) ou Internet (PUBLIC_URL).
 */
const path = require('path');
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
const nonceStore = require('./lib/nonce-store');
const { getGeofenceConfig, insideGeofence } = require('./lib/geo');
const { emargerFormPage } = require('./lib/emarger-page');
const { escapeHtml, errorPage, presenceSuccessPage } = require('./lib/html');
const { layoutAppPage, layoutPage } = require('./lib/ui-shell');
const presenceLog = require('./lib/presence-log');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

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

/** URL de présence signée (créneau 30 s + jeton à usage unique). */
function presenceUrl(nom, prenom) {
  const { slot, sig, nonce } = buildStudentToken(nom, prenom);
  nonceStore.issue(nonce, slot);
  const params = new URLSearchParams({
    nom: String(nom),
    prenom: String(prenom),
    t: String(slot),
    n: nonce,
    sig,
  });
  return `${baseUrl()}/presence?${params.toString()}`;
}

/** URL d'émargement via QR de séance (affiche classe). */
function sessionScanUrl() {
  const { slot, sig, nonce } = buildSessionToken();
  nonceStore.issue(nonce, slot);
  const params = new URLSearchParams({
    t: String(slot),
    n: nonce,
    sig,
  });
  return `${baseUrl()}/emarger?${params.toString()}`;
}

app.get('/api/presence', (req, res) => {
  res.json(presenceLog.list());
});

function rejectUsedOrInvalidQr(res) {
  return res
    .status(410)
    .send(
      errorPage(
        'QR invalide',
        'Ce code a expiré, a déjà été utilisé, ou provient d\'une photo. Scannez le QR affiché en direct à l\'écran.'
      )
    );
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
  const wifiSteps = publicMode
    ? ''
    : `<ol>
      <li>Même Wi-Fi PC / téléphone</li>
      <li>Pare-feu : <code>scripts\\parefeu.ps1</code> (admin)</li>
      <li>Pour Internet : définir <code>PUBLIC_URL</code> (voir ci-dessous)</li>
    </ol>`;
  res.send(
    layoutAppPage({
      title: 'Émargement QR',
      headerTitle: 'Émargement QR',
      headerSubtitle: 'Présence sécurisée en salle de cours',
      withSidebar: true,
      sidebarInit: 'initPresenceSidebar({ apiPath: "/api/presence" });',
      sidebarEmptyHint: 'Personne pour l’instant — la liste se remplit au fur et à mesure des scans.',
      sommaireItems: [
        { href: '#accueil-wifi', label: 'Connexion' },
        { href: '#accueil-internet', label: 'Internet' },
        { href: '#accueil-securite', label: 'Sécurité' },
        { href: '#accueil-classe', label: 'QR séance' },
        { href: '#accueil-eleve', label: 'QR par élève' },
        { href: '/diagnostic', label: 'Diagnostic' },
        { href: '/aide', label: 'Aide' },
      ],
      bodyHtml: `
  <div class="box" id="accueil-wifi">
    <h2>${publicMode ? 'Accès Internet (PUBLIC_URL)' : 'Accès téléphone (même Wi-Fi)'}</h2>
    ${phoneTestLinksHtml()}
    <p class="ip">URL dans les QR : ${escapeHtml(phoneUrl)}</p>
    ${wifiSteps}
  </div>

  <div class="box" id="accueil-internet">
    <h2>Passer sur Internet</h2>
    <p class="hint" style="margin:0;">Définissez l'URL publique avant <code>npm start</code> :</p>
    <p class="ip" style="margin-top:0.75rem;">set PUBLIC_URL=https://votre-url.ngrok-free.app</p>
    <p class="hint">Ou déployez sur <strong>Render</strong> — le fichier <code>render.yaml</code> est prêt.</p>
  </div>

  <div class="box" id="accueil-securite">
    <h2>Sécurité</h2>
    <ul>
      <li>QR <strong>usage unique</strong> (une photo ne peut pas être réutilisée)</li>
      <li>QR <strong>renouvelé toutes les 30 s</strong></li>
      <li><strong>Géolocalisation</strong> : émarger uniquement sur place (.env)</li>
    </ul>
  </div>

  <div class="box" id="accueil-classe">
    <h2>Mode classe (recommandé)</h2>
    <p class="hint" style="margin:0;">QR unique qui change toutes les 30 s — à projeter sur un écran.</p>
    <a class="btn-primary btn-green" href="/affiche" style="width:100%;margin-top:1rem;">Ouvrir le QR de séance →</a>
  </div>

  <div class="box" id="accueil-eleve">
    <h2>QR par élève</h2>
    <form action="/qr" method="get">
      <label for="nom">Nom</label>
      <input id="nom" name="nom" required placeholder="Dupont">
      <label for="prenom">Prénom</label>
      <input id="prenom" name="prenom" required placeholder="Marie">
      <button type="submit" class="btn-primary" style="width:100%;">Afficher le QR (30 s)</button>
    </form>
  </div>

  <p class="links"><a href="/diagnostic">Diagnostic</a> · <a href="/aide">Aide</a> · <a href="/static/teacher.html">Interface professeur</a></p>`,
    })
  );
});

app.get('/diagnostic', (req, res) => {
  const client = req.socket.remoteAddress || '';
  res.send(
    layoutPage({
      title: 'Diagnostic',
      headerTitle: 'Diagnostic serveur',
      headerSubtitle: 'Vérification de la connexion',
      bodyHtml: `
  <div class="panel">
    <p style="color:var(--success);font-weight:600;">✓ Serveur actif sur le port <strong>${PORT}</strong></p>
    <p class="hint">Votre appareil : <code>${escapeHtml(client)}</code></p>
    <p class="hint">Heure serveur : ${new Date().toLocaleString('fr-FR')}</p>
    <h2 style="margin-top:1.5rem;font-size:1rem;">Adresses pour le téléphone</h2>
    ${phoneTestLinksHtml()}
    <h2 style="margin-top:1.5rem;font-size:1rem;">Commandes utiles (PC)</h2>
    <pre class="ip" style="white-space:pre-wrap;">npm run stop
npm start</pre>
    <p class="links"><a href="/affiche">QR de séance</a> · <a href="/">Accueil</a></p>
  </div>`,
    })
  );
});

// ——— Test connexion téléphone ———
app.get('/test', (req, res) => {
  res.send(
    layoutPage({
      title: 'Test connexion',
      headerTitle: 'Test connexion',
      headerSubtitle: 'Vérification réseau',
      bodyHtml: `
  <div class="center-page panel">
    <div class="result-icon ok" style="font-size:2.5rem;">✓</div>
    <h1 style="font-family:var(--font-display);margin:0.5rem 0;">Connexion OK</h1>
    <p class="hint">Votre téléphone atteint bien le serveur.</p>
    <p class="hint">Vous pouvez scanner le QR d'émargement.</p>
  </div>`,
    })
  );
});

app.get('/aide', (req, res) => {
  const u = baseUrl();
  res.send(
    layoutPage({
      title: 'Aide téléphone',
      headerTitle: 'Aide',
      headerSubtitle: 'Connexion du téléphone au serveur',
      bodyHtml: `
  <div class="panel">
    <p class="hint">Le QR contient une URL avec l'<strong>IP du PC</strong>, par exemple :</p>
    <p class="ip">${escapeHtml(u)}/emarger?...</p>
    <p class="hint">Au scan, le navigateur du téléphone contacte le PC sur le Wi-Fi — comme un site local.</p>
    <h2 style="font-size:1rem;margin-top:1.5rem;">Checklist</h2>
    <ul class="hint">
      <li>Serveur lancé : <code>npm start</code></li>
      <li>Même Wi-Fi PC / téléphone</li>
      <li>Pas de VPN isolant le téléphone</li>
      <li>Pare-feu : autoriser Node.js sur réseau privé</li>
      <li>Test : <code>${escapeHtml(u)}/test</code></li>
    </ul>
    <p class="links"><a href="/">← Retour</a></p>
  </div>`,
    })
  );
});

// ——— Affiche classe : QR séance, rafraîchi toutes les 30 s ———
app.get('/affiche', (req, res) => {
  res.send(
    layoutAppPage({
      title: 'QR séance — émargement',
      headerTitle: 'Scannez pour émarger',
      headerSubtitle: 'QR renouvelé toutes les 30 s — usage unique',
      extraClass: 'page-affiche',
      withSidebar: true,
      sidebarInit: 'initPresenceSidebar({ apiPath: "/api/presence" });',
      sidebarEmptyHint: 'En attente du premier scan…',
      sommaireItems: [
        { href: '#affiche-qr', label: 'Code QR' },
        { href: '#affiche-infos', label: 'Consignes' },
      ],
      bodyHtml: `
  <div class="qr-frame" id="affiche-qr" style="margin:0 auto;max-width:420px;">
    <img id="qr" class="qr-img loaded" alt="QR code séance" width="320" height="320">
    <p class="timer" style="color:#404040;margin-top:1rem;">Prochain QR dans <span id="sec" style="color:#0a0a0a;font-weight:700;">30</span> s</p>
  </div>
  <div id="affiche-infos">
    <p class="hint" style="text-align:center;max-width:24rem;margin:1rem auto;">Ne photographiez pas le QR : une capture ne fonctionnera pas.</p>
    <p class="phone">${escapeHtml(baseUrl())}</p>
  </div>
  <script>
    const img = document.getElementById('qr');
    const secEl = document.getElementById('sec');
    const WINDOW = ${WINDOW_MS};
    function refreshQr() { img.src = '/qr-session.png?_=' + Date.now(); }
    function updateCountdown() {
      const left = Math.ceil((WINDOW - (Date.now() % WINDOW)) / 1000);
      secEl.textContent = left;
      if (left <= 1) refreshQr();
    }
    refreshQr();
    setInterval(refreshQr, WINDOW);
    setInterval(updateCountdown, 250);
    updateCountdown();
  </script>`,
    })
  );
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

// ——— Après scan du QR séance : formulaire nom / prénom + GPS ———
app.get('/emarger', (req, res) => {
  const { t, sig, n } = req.query;
  if (!verifySessionQuery(t, sig)) return rejectUsedOrInvalidQr(res);
  if (!n || nonceStore.isUsed(n) || !nonceStore.canOpen(n)) {
    return rejectUsedOrInvalidQr(res);
  }

  const geo = getGeofenceConfig();
  res.send(
    emargerFormPage({
      t,
      sig,
      n,
      geofenceEnabled: geo.enabled,
      radius: geo.radius,
      lat: geo.lat,
      lon: geo.lon,
    })
  );
});

app.post('/emarger', (req, res) => {
  const { t, sig, n, nom, prenom, latitude, longitude } = req.body;
  const nomTrim = (nom || '').trim();
  const prenomTrim = (prenom || '').trim();

  if (!verifySessionQuery(t, sig)) return rejectUsedOrInvalidQr(res);
  if (!n || !nonceStore.consume(n)) return rejectUsedOrInvalidQr(res);
  if (!nomTrim || !prenomTrim) {
    return res.status(400).send(errorPage('Erreur', 'Nom et prénom requis.'));
  }

  const geoCheck = insideGeofence(
    parseFloat(latitude),
    parseFloat(longitude)
  );
  if (!geoCheck.ok) {
    return res
      .status(403)
      .send(errorPage('Hors zone', geoCheck.reason || 'Géolocalisation refusée.'));
  }

  presenceLog.record({ prenom: prenomTrim, nom: nomTrim, auth: 'form' });
  console.log(
    `[PRÉSENCE] ${prenomTrim} ${nomTrim} — ${new Date().toISOString()}` +
      (geoCheck.distance != null ? ` (${Math.round(geoCheck.distance)} m)` : '')
  );
  res.send(presenceSuccessPage(prenomTrim, nomTrim));
});

// ——— QR par élève (page avec rafraîchissement 30 s) ———
app.get('/qr', (req, res) => {
  const { nom, prenom } = req.query;
  if (!nom || !prenom) {
    return res.status(400).send('Paramètres : ?nom=...&prenom=...');
  }

  const n = escapeHtml(nom);
  const p = escapeHtml(prenom);

  res.send(
    layoutPage({
      title: `QR — ${p} ${n}`,
      headerTitle: `${p} ${n}`,
      headerSubtitle: 'QR valide 30 s — rescannez si expiré',
      bodyHtml: `
  <div class="qr-frame" style="margin:0 auto;max-width:400px;">
    <img id="qr" class="qr-img loaded" alt="QR présence" width="300" height="300">
    <p class="timer" style="color:#404040;margin-top:1rem;">Prochain QR dans <span id="sec" style="font-weight:700;color:#0a0a0a;">30</span> s</p>
  </div>
  <p class="links" style="text-align:center;margin-top:1.25rem;"><a href="/">← Retour</a></p>
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
  </script>`,
    })
  );
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
  const { t, sig, n } = req.query;

  if (!nom || !prenom) {
    return res
      .status(400)
      .send(errorPage('Lien invalide', 'Nom et prénom manquants.'));
  }

  if (!verifyStudentQuery(nom, prenom, t, n, sig)) return rejectUsedOrInvalidQr(res);
  if (!n || !nonceStore.consume(n)) return rejectUsedOrInvalidQr(res);

  presenceLog.record({ prenom, nom, auth: 'qr-eleve' });
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
  const geo = getGeofenceConfig();
  if (geo.enabled) {
    console.log(`  Géolocalisation : ON (${geo.radius} m autour de ${geo.lat}, ${geo.lon})`);
  } else {
    console.log('  Géolocalisation : OFF (définir SCHOOL_LATITUDE / SCHOOL_LONGITUDE)');
  }
  console.log('  Anti-photo      : jeton à usage unique par QR');
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
