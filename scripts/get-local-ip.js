const { getLocalIp } = require('../lib/get-local-ip');

const ip = getLocalIp();
if (!ip) {
  console.error(
    'Aucune adresse IP locale trouvée. Vérifiez votre connexion Wi-Fi.'
  );
  process.exit(1);
}
console.log(ip);
