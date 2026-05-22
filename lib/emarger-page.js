const { escapeHtml } = require('./html');

/** Page formulaire avec géolocalisation obligatoire (si activée). */
function emargerFormPage({ t, sig, n, geofenceEnabled, radius, lat, lon }) {
  const geoHint = geofenceEnabled
    ? `<p class="geo">📍 Vous devez être sur place (rayon ${radius} m). La localisation sera demandée.</p>`
    : '';

  return `<!DOCTYPE html>
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
    .geo { font-size: 0.85rem; color: #15803d; background: #dcfce7; padding: 0.6rem; border-radius: 8px; }
    .warn { color: #b45309; font-size: 0.9rem; display: none; }
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
    button:disabled { opacity: 0.5; }
  </style>
</head>
<body>
  <h1>Validation de présence</h1>
  <p>Scannez le QR <strong>en direct</strong> (pas une photo).</p>
  ${geoHint}
  <p id="err" class="warn"></p>
  <form id="f" method="post" action="/emarger">
    <input type="hidden" name="t" value="${escapeHtml(t)}">
    <input type="hidden" name="sig" value="${escapeHtml(sig)}">
    <input type="hidden" name="n" value="${escapeHtml(n)}">
    <input type="hidden" name="latitude" id="lat">
    <input type="hidden" name="longitude" id="lng">
    <label for="prenom">Prénom</label>
    <input id="prenom" name="prenom" required autocomplete="given-name">
    <label for="nom">Nom</label>
    <input id="nom" name="nom" required autocomplete="family-name">
    <button type="submit" id="btn">Confirmer ma présence</button>
  </form>
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
  </script>
</body>
</html>`;
}

module.exports = { emargerFormPage };
