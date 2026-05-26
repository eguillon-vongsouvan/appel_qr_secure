const { escapeHtml } = require('./escape-html');

const THEME_CSS = '/static/css/theme.css';
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' +
  '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />';

const IMG = {
  logo: '/static/img/logo-guardia.png',
};

function textureLayers() {
  return `<div class="tex-layer tex-hex" aria-hidden="true"></div>
  <div class="tex-layer tex-grid" aria-hidden="true"></div>
  <div class="tex-layer tex-noise" aria-hidden="true"></div>
  <div class="tex-layer tex-vignette" aria-hidden="true"></div>`;
}

function themeHead(title) {
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${FONTS}
  <link rel="stylesheet" href="${THEME_CSS}" />`;
}

function pageHeader({ title, subtitle }) {
  const sub = subtitle ? `<p>${escapeHtml(subtitle)}</p>` : '';
  return `<header class="site-header">
    <img class="site-logo" src="${IMG.logo}" alt="Logo" width="56" height="56" />
    <div class="site-header-text">
      <h1>${escapeHtml(title)}</h1>
      ${sub}
    </div>
  </header>`;
}

/** Sommaire : liens ancres (#) ou pages (/). */
function sommaireNav(items) {
  if (!items || !items.length) return '';
  const lis = items
    .map(
      (it) =>
        `<li><a href="${escapeHtml(it.href)}">${escapeHtml(it.label)}</a></li>`
    )
    .join('');
  return `<nav class="sommaire" aria-label="Sommaire">
    <p class="sommaire-title">Sommaire</p>
    <ol class="sommaire-list">${lis}</ol>
  </nav>`;
}

function presenceSidebarHtml({ emptyHint }) {
  const hint =
    emptyHint ||
    'La liste se met à jour automatiquement quand un élève émerge.';
  return `<aside class="app-sidebar" aria-label="Personnes connectées">
    <div class="sidebar-head">
      <h2>Connectés</h2>
      <span class="presence-count" id="presence-count">0</span>
    </div>
    <p class="sidebar-hint">Mise à jour automatique toutes les 2 s.</p>
    <p class="presence-empty" id="presence-empty" hidden>${escapeHtml(hint)}</p>
    <ul class="presence-list" id="presence-list"></ul>
  </aside>`;
}

function sidebarScript(initCode) {
  return `<script src="/static/js/presence-sidebar.js"></script>
  <script>${initCode}</script>`;
}

/**
 * Mise en page : contenu principal + barre latérale éloignée + sommaire optionnel.
 */
function layoutAppPage({
  title,
  headerTitle,
  headerSubtitle,
  bodyHtml,
  extraClass = '',
  sommaireItems = null,
  withSidebar = false,
  sidebarInit = 'initPresenceSidebar({ apiPath: "/api/presence" });',
  sidebarEmptyHint,
}) {
  const header = pageHeader({
    title: headerTitle || title,
    subtitle: headerSubtitle || '',
  });
  const sommaire = sommaireNav(sommaireItems);
  const sidebar = withSidebar
    ? presenceSidebarHtml({ emptyHint: sidebarEmptyHint }) +
      sidebarScript(sidebarInit)
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  ${themeHead(title)}
</head>
<body class="has-sidebar ${extraClass}">
  ${textureLayers()}
  <div class="app-shell">
    <div class="app-main">
      ${header}
      ${sommaire}
      ${bodyHtml}
    </div>
    ${sidebar}
  </div>
</body>
</html>`;
}

function layoutPage(opts) {
  return layoutAppPage({ ...opts, withSidebar: false, sommaireItems: null });
}

module.exports = {
  IMG,
  THEME_CSS,
  FONTS,
  themeHead,
  textureLayers,
  pageHeader,
  sommaireNav,
  presenceSidebarHtml,
  layoutAppPage,
  layoutPage,
};
