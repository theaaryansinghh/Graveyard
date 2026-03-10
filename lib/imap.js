// ─────────────────────────────────────────────
//  JobTracker — imap.js
//  IMAP fetcher (TCP via chrome.sockets or proxy)
//
//  NOTE: True IMAP TCP sockets require a native
//  messaging host or a local proxy. This module
//  provides the IMAP command builder + parser so
//  users can optionally run the bundled tiny
//  Node proxy (see /proxy/server.js in the repo).
//  The extension talks to localhost:7357.
// ─────────────────────────────────────────────

const IMAP = (() => {

  const PROXY_URL = 'http://localhost:7357';

  async function connect(config) {
    const res = await fetch(`${PROXY_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port || 993,
        tls: config.tls !== false,
        user: config.user,
        pass: config.pass
      })
    });
    if (!res.ok) throw new Error(`Connection failed: ${res.statusText}`);
    return res.json(); // { sessionId }
  }

  async function fetchEmails(sessionId, options = {}) {
    const res = await fetch(`${PROXY_URL}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        folder: options.folder || 'INBOX',
        since: options.since || null,   // JS Date or null for all
        limit: options.limit || 100,
        fields: ['FROM', 'SUBJECT', 'DATE', 'BODY[TEXT]']
      })
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    return res.json(); // { emails: [...] }
  }

  async function disconnect(sessionId) {
    await fetch(`${PROXY_URL}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    }).catch(() => {});
  }

  // ── Health check — is local proxy running? ──
  async function isProxyRunning() {
    try {
      const res = await fetch(`${PROXY_URL}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  return { connect, fetchEmails, disconnect, isProxyRunning, PROXY_URL };
})();

if (typeof module !== 'undefined') module.exports = IMAP;