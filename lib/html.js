const { escapeHtml } = require('./escape-html');
const { layoutPage } = require('./ui-shell');

/** Page minimale après scan QR — uniquement « Tu es présent ». */
function presentSuccessPage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tu es présent</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/static/css/theme.css" />
</head>
<body class="page-present-ok">
  <div class="tex-layer tex-hex" aria-hidden="true"></div>
  <div class="tex-layer tex-noise" aria-hidden="true"></div>
  <div class="present-screen">
    <div class="present-badge" aria-hidden="true">✓</div>
    <p class="present-title">Tu es présent</p>
    <p class="present-sub">Ta présence a été enregistrée. Tu peux fermer cette page.</p>
  </div>
</body>
</html>`;
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/static/css/theme.css" />
</head>
<body class="page-present-ok">
  <div class="present-screen">
    <div class="present-badge present-badge--err" aria-hidden="true">✕</div>
    <p class="present-title">${escapeHtml(title)}</p>
    <p class="present-sub">${message}</p>
  </div>
</body>
</html>`;
}

/** @deprecated utiliser presentSuccessPage */
function presenceSuccessPage(prenom, nom) {
  return presentSuccessPage();
}

module.exports = { escapeHtml, errorPage, presentSuccessPage, presenceSuccessPage, layoutPage };
