const { escapeHtml } = require('./escape-html');
const { layoutPage } = require('./ui-shell');

function errorPage(title, message) {
  return layoutPage({
    title,
    headerTitle: title,
    headerSubtitle: 'Une erreur est survenue',
    extraClass: 'result-page',
    bodyHtml: `
    <div class="result-main">
      <div class="result-card panel">
        <div class="result-icon err" aria-hidden="true">✕</div>
        <p>${message}</p>
        <p style="margin-top:1.25rem;"><a class="btn-ghost" href="/">← Retour</a></p>
      </div>
    </div>`,
  });
}

function presenceSuccessPage(prenom, nom) {
  const fullName = `${escapeHtml(prenom)} ${escapeHtml(nom)}`;
  const time = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return layoutPage({
    title: `Présence — ${fullName}`,
    headerTitle: 'Émargement enregistré',
    headerSubtitle: fullName,
    extraClass: 'result-page',
    bodyHtml: `
    <div class="result-main">
      <div class="result-card panel">
        <div class="result-icon ok" aria-hidden="true">✓</div>
        <p class="hint" style="margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.1em;font-size:0.72rem;font-weight:700;">Validation de présence</p>
        <p style="font-size:1.4rem;font-weight:700;margin:0.25rem 0;color:var(--ink);">${fullName}</p>
        <p style="color:var(--success);font-weight:600;">présent(e)</p>
        <p class="hint" style="margin-top:1rem;font-size:0.8rem;">${escapeHtml(time)}</p>
      </div>
    </div>`,
  });
}

module.exports = { escapeHtml, errorPage, presenceSuccessPage, layoutPage };
