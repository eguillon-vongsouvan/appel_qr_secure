function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 1.5rem;
      background: #fef2f2;
      color: #991b1b;
      text-align: center;
    }
    .card {
      background: #fff;
      border: 1px solid #fecaca;
      border-radius: 1rem;
      padding: 2rem;
      max-width: 22rem;
    }
    h1 { font-size: 1.1rem; margin: 0 0 0.75rem; }
    p { margin: 0; line-height: 1.5; font-size: 0.95rem; }
    a { color: #2563eb; display: inline-block; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
    <a href="/">Retour</a>
  </div>
</body>
</html>`;
}

function presenceSuccessPage(prenom, nom) {
  const fullName = `${escapeHtml(prenom)} ${escapeHtml(nom)}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Présence — ${fullName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(160deg, #ecfdf5 0%, #f0fdf4 50%, #ffffff 100%);
      padding: 1.5rem;
      color: #14532d;
    }
    .card {
      width: 100%;
      max-width: 22rem;
      background: #fff;
      border-radius: 1.25rem;
      padding: 2rem 1.5rem;
      text-align: center;
      box-shadow: 0 10px 40px rgba(22, 101, 52, 0.12);
      border: 1px solid #bbf7d0;
    }
    .badge {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #15803d;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }
    .check {
      width: 4.5rem;
      height: 4.5rem;
      margin: 0 auto 1.25rem;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.45);
    }
    .check svg {
      width: 2.5rem;
      height: 2.5rem;
      stroke: #fff;
      stroke-width: 3;
      fill: none;
    }
    h1 { font-size: 1rem; font-weight: 600; color: #166534; margin-bottom: 0.5rem; }
    .name { font-size: 1.65rem; font-weight: 700; line-height: 1.3; color: #052e16; margin-bottom: 0.35rem; }
    .status { font-size: 1.1rem; color: #15803d; font-weight: 500; }
    .time { margin-top: 1.5rem; font-size: 0.8rem; color: #86efac; }
  </style>
</head>
<body>
  <div class="card">
    <p class="badge">Validation de présence</p>
    <div class="check" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h1>Émargement enregistré</h1>
    <p class="name">${fullName}</p>
    <p class="status">présent(e)</p>
    <p class="time">${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
  </div>
</body>
</html>`;
}

module.exports = { escapeHtml, errorPage, presenceSuccessPage };
