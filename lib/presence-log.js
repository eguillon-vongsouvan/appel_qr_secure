const crypto = require('crypto');

/** Journal en mémoire des présences (MVP). */
const entries = [];

function record({ prenom, nom, email, auth = 'form', room, sessionId, uniqueKey }) {
  const p = String(prenom || '').trim();
  const n = String(nom || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  const key =
    uniqueKey ||
    mail ||
    (p || n ? `${p}|${n}`.toLowerCase() : crypto.randomUUID());
  if (!key) return null;

  const at = new Date().toISOString();
  const displayName = p || n ? [p, n].filter(Boolean).join(' ') : 'Présent';

  const existing = uniqueKey ? null : entries.find((e) => e.key === key);
  if (existing) {
    existing.at = at;
    if (room) existing.room = room;
    if (sessionId) existing.sessionId = sessionId;
    return existing;
  }

  const entry = {
    id: crypto.randomUUID(),
    key,
    prenom: p || 'Présent',
    nom: n,
    student_name: displayName,
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
  return rows.map(
    ({
      id,
      prenom,
      nom,
      student_name,
      email,
      auth,
      room,
      sessionId: sid,
      at,
    }) => ({
      id,
      prenom,
      nom,
      student_name:
        student_name || [prenom, nom].filter(Boolean).join(' ') || email || 'Présent',
      student_id: email || `${prenom} ${nom}`.trim(),
      email,
      auth,
      room,
      session_id: sid,
      at,
    })
  );
}

function count({ sessionId } = {}) {
  return list({ sessionId }).length;
}

module.exports = { record, list, count };
