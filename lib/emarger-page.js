const { escapeHtml } = require('./escape-html');
const { layoutPage } = require('./ui-shell');

/** Page formulaire avec géolocalisation obligatoire (si activée). */
function emargerFormPage({ t, sig, n, geofenceEnabled, radius, lat, lon }) {
  const geoHint = geofenceEnabled
    ? `<p class="alert" style="margin-bottom:1rem;"><strong>Géolocalisation requise</strong> Vous devez être sur place (rayon ${radius} m). Autorisez la localisation dans votre navigateur.</p>`
    : '';

  const body = `
    <section class="panel">
      <h2>Validation de présence</h2>
      <p class="hint">Scannez le QR <strong>en direct</strong> sur l’écran — une photo ne fonctionnera pas.</p>
      ${geoHint}
      <p id="err" class="warn" style="display:none;margin-bottom:1rem;"></p>
      <form id="f" method="post" action="/emarger">
        <input type="hidden" name="t" value="${escapeHtml(t)}">
        <input type="hidden" name="sig" value="${escapeHtml(sig)}">
        <input type="hidden" name="n" value="${escapeHtml(n)}">
        <input type="hidden" name="latitude" id="lat">
        <input type="hidden" name="longitude" id="lng">
        <label for="prenom">Prénom</label>
        <input id="prenom" name="prenom" required autocomplete="given-name" placeholder="Marie">
        <label for="nom">Nom</label>
        <input id="nom" name="nom" required autocomplete="family-name" placeholder="Dupont">
        <button type="submit" class="primary" id="btn" style="width:100%;">Confirmer ma présence</button>
      </form>
    </section>
    <script>
      const geoRequired = ${geofenceEnabled ? 'true' : 'false'};
      const err = document.getElementById('err');
      const btn = document.getElementById('btn');
      const lat = document.getElementById('lat');
      const lng = document.getElementById('lng');

      function showErr(msg) {
        err.style.display = 'block';
        err.textContent = msg;
        btn.disabled = true;
      }

      if (geoRequired && !navigator.geolocation) {
        showErr('Géolocalisation non disponible sur cet appareil.');
      } else if (geoRequired) {
        btn.disabled = true;
        btn.textContent = 'Localisation en cours…';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat.value = pos.coords.latitude;
            lng.value = pos.coords.longitude;
            btn.disabled = false;
            btn.textContent = 'Confirmer ma présence';
          },
          () => showErr('Autorisez la localisation pour émarger (réglages du navigateur).'),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    </script>`;

  return layoutPage({
    title: 'Émarger',
    headerTitle: 'Émargement',
    headerSubtitle: 'Confirmez votre présence en cours',
    bodyHtml: body,
  });
}

module.exports = { emargerFormPage };
