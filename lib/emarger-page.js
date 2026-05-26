const { escapeHtml } = require('./escape-html');

/**
 * Après scan du QR séance : géoloc si besoin, puis envoi auto → « Tu es présent ».
 */
function emargerFormPage({ t, sig, n, geofenceEnabled, radius }) {
  const geoHint = geofenceEnabled
    ? `<p class="present-loading" id="status">Localisation en cours…</p>`
    : `<p class="present-loading" id="status">Enregistrement…</p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Émargement</title>
  <link rel="stylesheet" href="/static/css/theme.css" />
</head>
<body class="page-present-ok">
  <div class="present-screen">
    <div class="present-spinner" aria-hidden="true"></div>
    ${geoHint}
    <p id="err" class="present-sub" style="color:var(--error);display:none;"></p>
  </div>
  <form id="f" method="post" action="/emarger" style="display:none;">
    <input type="hidden" name="t" value="${escapeHtml(t)}">
    <input type="hidden" name="sig" value="${escapeHtml(sig)}">
    <input type="hidden" name="n" value="${escapeHtml(n)}">
    <input type="hidden" name="latitude" id="lat">
    <input type="hidden" name="longitude" id="lng">
    <input type="hidden" name="prenom" value="Présent">
    <input type="hidden" name="nom" value="">
  </form>
  <script>
    const geoRequired = ${geofenceEnabled ? 'true' : 'false'};
    const status = document.getElementById('status');
    const err = document.getElementById('err');
    const form = document.getElementById('f');

    function fail(msg) {
      document.querySelector('.present-spinner').style.display = 'none';
      if (status) status.style.display = 'none';
      err.style.display = 'block';
      err.textContent = msg;
    }

    function submitPresence() {
      if (status) status.textContent = 'Enregistrement…';
      form.submit();
    }

    if (geoRequired && !navigator.geolocation) {
      fail('Géolocalisation requise — autorisez-la dans le navigateur.');
    } else if (geoRequired) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('lat').value = pos.coords.latitude;
          document.getElementById('lng').value = pos.coords.longitude;
          submitPresence();
        },
        () => fail('Autorisez la localisation pour confirmer votre présence.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      submitPresence();
    }
  </script>
</body>
</html>`;
}

module.exports = { emargerFormPage };
