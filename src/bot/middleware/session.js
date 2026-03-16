// In-memory session sederhana (bisa diganti Redis untuk production)
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {});
  }
  return sessions.get(chatId);
}

function setSession(chatId, data) {
  const current = getSession(chatId);
  sessions.set(chatId, { ...current, ...data });
}

function clearSession(chatId) {
  sessions.set(chatId, {});
}

function deleteSession(chatId) {
  sessions.delete(chatId);
}

module.exports = { getSession, setSession, clearSession, deleteSession };
