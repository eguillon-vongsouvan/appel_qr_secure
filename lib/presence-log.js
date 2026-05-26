const crypto = require('crypto');

/** Journal en mémoire des présences (MVP). */
const entries = [];

function record({ prenom, nom, email, auth = 'form', room, sessionId }) {
  const p = String(prenom || '').trim();
  const n = String(nom || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  const key = mail || `${p}|${n}`.toLowerCase();
  if (!key || key === '|') return null;

  const existing = entries.find((e) => e.key === key);
  const at = new Date().toISOString();
  if (existing) {
    existing.at = at;
    if (room) existing.room = room;
    if (sessionId) existing.sessionId = sessionId;
    return existing;
  }

  const entry = {
    id: crypto.randomUUID(),
    key,
    prenom: p,
    nom: n,
    email: mail || null,
    auth,
    room: room || null,
    sessionId: sessionId || null,
    at,
  };
  entries.unshift(entry);
  return entry;
}

function list({ sessionId } = {}) {
  let rows = entries;
  if (sessionId) {
    rows = rows.filter((e) => e.sessionId === sessionId);
  }
  return rows.map(({ id, prenom, nom, email, auth, room, sessionId: sid, at }) => ({
    id,
    prenom,
    nom,
    student_name: [prenom, nom].filter(Boolean).join(' ') || email,
    student_id: email || `${prenom} ${nom}`.trim(),
    email,
    auth,
    room,
    session_id: sid,
    at,
  }));
}

function count({ sessionId } = {}) {
  return list({ sessionId }).length;
}

module.exports = { record, list, count };
