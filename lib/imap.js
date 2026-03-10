const IMAP = (() => {

  const PROXY_URL = 'http://localhost:7357';

  //extension talks to a small local proxy becuase chrome cant directly do raw imap tcp
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

    return res.json();
  }

  //fetching emails from inbox
  async function fetchEmails(sessionId, options = {}) {

    const res = await fetch(`${PROXY_URL}/fetch`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({
        sessionId,
        folder: options.folder || 'INBOX',
        since: options.since || null,
        limit: options.limit || 100,

        //only grabbing fields we actually need
        fields: ['FROM', 'SUBJECT', 'DATE', 'BODY[TEXT]']
      })

    });

    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);

    return res.json();
  }

  //closing imap session
  async function disconnect(sessionId) {

    await fetch(`${PROXY_URL}/disconnect`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ sessionId })

    }).catch(() => {});

  }

  //simple health check to see if proxy server is running
  async function isProxyRunning() {

    try {

      const res = await fetch(`${PROXY_URL}/health`, { method: 'GET' });
      return res.ok;
    }
    catch {
      //usually means proxy not running
      return false;
    }

  }
  return { connect, fetchEmails, disconnect, isProxyRunning, PROXY_URL };

})();


if (typeof module !== 'undefined') module.exports = IMAP;