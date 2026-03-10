#!/usr/bin/env node

const http    = require('http');
const Imap    = require('imap');
const { simpleParser } = require('mailparser');
const crypto  = require('crypto');

const PORT = 7357;

const sessions = new Map();

//reads json body from request
function readBody(req) {

  return new Promise((res, rej) => {

    let data = '';

    req.on('data', c => data += c);

    req.on('end', () => {

      try {
        res(JSON.parse(data));
      }
      catch {
        rej(new Error('Bad JSON'));
      }

    });

  });

}



function send(res, status, body) {

  const json = JSON.stringify(body);

  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });

  res.end(json);
}




//creating imap instance from config
function createImap(config) {

  return new Imap({
    user:     config.user,
    password: config.pass,
    host:     config.host,
    port:     config.port || 993,
    tls:      config.tls !== false,

    //not the most secure but avoids cert issues
    tlsOptions: { rejectUnauthorized: false }
  });

}
//opening inbox before searching
function openInbox(imap) {

  return new Promise((res, rej) => {

    imap.openBox('INBOX', true, (err, box) => err ? rej(err) : res(box));

  });

}

//searching emails using imap criteria
function searchEmails(imap, criteria) {

  return new Promise((res, rej) => {

    imap.search(criteria, (err, uids) => err ? rej(err) : res(uids));

  });

}
//fetching messages and parsing some fields
function fetchMessages(imap, uids) {

  return new Promise((res, rej) => {

    if (!uids.length) return res([]);

    const emails = [];

    const f = imap.fetch(uids, {
      bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)', 'TEXT'],
      struct: false
    });



    f.on('message', (msg, seqno) => {

      const email = { id: null, headers: null, body: '' };

      msg.on('body', (stream, info) => {

        let raw = '';

        stream.on('data', c => raw += c.toString('utf8'));

        stream.on('end', () => {

          if (info.which.startsWith('HEADER')) {

            //quick regex parsing for headers
            const fromMatch    = raw.match(/^From:\s*(.+)$/mi);
            const subjectMatch = raw.match(/^Subject:\s*(.+)$/mi);
            const dateMatch    = raw.match(/^Date:\s*(.+)$/mi);

            email.from    = fromMatch?.[1]?.trim() || '';
            email.subject = subjectMatch?.[1]?.trim() || '';
            email.date    = dateMatch?.[1]?.trim() || '';

          }

          else {

            //limit body size otherwise huge emails slow things
            email.body += raw.slice(0, 2000);

          }

        });

      });



      msg.once('attributes', attrs => {

        email.id = String(attrs.uid);

      });



      msg.once('end', () => {

        //trying to get name from "name <email>"
        const nameMatch = email.from.match(/^"?([^"<]+)"?\s*</);

        email.fromName = nameMatch ? nameMatch[1].trim() : '';

        emails.push(email);

      });

    });



    f.once('error', rej);

    f.once('end', () => res(emails));

  });

}

const routes = {

  'GET /health': (_req, res) => {

    send(res, 200, { ok: true, sessions: sessions.size });

  },


  //creates imap session
  'POST /connect': async (req, res) => {

    const config = await readBody(req);

    const imap = createImap(config);

    await new Promise((resolve, reject) => {

      imap.once('ready', resolve);

      imap.once('error', reject);

      imap.connect();

    });


    const sessionId = crypto.randomUUID();

    sessions.set(sessionId, imap);

    console.log(`[proxy] Session ${sessionId} opened for ${config.user}`);

    send(res, 200, { sessionId });

  },

  'POST /fetch': async (req, res) => {

    const { sessionId, since, limit } = await readBody(req);
    const imap = sessions.get(sessionId);
    if (!imap) return send(res, 404, { error: 'Session not found' });
    await openInbox(imap);
    let criteria = ['ALL'];
    if (since) {

      const d = new Date(since);

      const dateStr = d.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      criteria = [['SINCE', dateStr]];
    }

    let uids = await searchEmails(imap, criteria);

    //taking only most recent few
    uids = uids.slice(-Math.min(uids.length, limit || 100));


    const emails = await fetchMessages(imap, uids);

    console.log(`[proxy] Fetched ${emails.length} emails`);

    send(res, 200, { emails });

  },

  'POST /disconnect': async (req, res) => {

    const { sessionId } = await readBody(req);

    const imap = sessions.get(sessionId);

    if (imap) {

      imap.end();

      sessions.delete(sessionId);

    }

    send(res, 200, { ok: true });

  }

};

//basic http server
const server = http.createServer(async (req, res) => {

  //cors preflight
  if (req.method === 'OPTIONS') {

    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    return res.end();
  }

  const key = `${req.method} ${req.url}`;

  const handler = routes[key];

  if (!handler) return send(res, 404, { error: 'Not found' });

  try {

    await handler(req, res);

  }

  catch (err) {

    console.error('[proxy] Error:', err.message);

    send(res, 500, { error: err.message });

  }

});

server.listen(PORT, '127.0.0.1', () => {

  console.log(`\n📬 JobTracker proxy running at http://localhost:${PORT}`);

  console.log('   Leave this terminal open while using the extension.\n');

});