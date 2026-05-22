/**
 * Libère le port du serveur (Windows).
 * Usage : npm run stop
 */
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;

try {
  const out = execSync(`netstat -ano | findstr :${PORT}`, {
    encoding: 'utf8',
    windowsHide: true,
  });
  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  if (pids.size === 0) {
    console.log(`Port ${PORT} déjà libre.`);
    process.exit(0);
  }
  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
    console.log(`Processus ${pid} arrêté.`);
  }
  console.log(`Port ${PORT} libéré. Lancez : npm start`);
} catch (e) {
  if (e.status === 1) {
    console.log(`Port ${PORT} déjà libre.`);
  } else {
    console.error(e.message);
    process.exit(1);
  }
}
