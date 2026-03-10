importScripts('lib/classifier.js', 'lib/imap.js', 'lib/csv.js');

const POLL_ALARM   = 'jobtracker-poll';
const POLL_MINUTES = 30;
const STORE_KEY    = 'jobtracker_apps';
const CONFIG_KEY   = 'jobtracker_config';



//extension starts here when installed
chrome.runtime.onInstalled.addListener(() => {

  chrome.alarms.create(POLL_ALARM, {
    periodInMinutes: POLL_MINUTES
  });

  console.log('[Graveyard] Installed. Polling every', POLL_MINUTES, 'min.');
});



//alarm triggers periodic scan
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === POLL_ALARM) runScan();
});



//messages coming from popup ui
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {

  switch (msg.type) {

    case 'SCAN_NOW':
      runScan()
        .then(() => reply({ ok: true }))
        .catch(e => reply({ ok: false, error: e.message }));
      return true;

    case 'GET_APPS':
      getApps().then(apps => reply({ apps }));
      return true;

    case 'CLEAR_APPS':
      chrome.storage.local.remove(STORE_KEY, () => reply({ ok: true }));
      return true;

    case 'EXPORT_CSV':
      getApps().then(apps => {
        CSV.download(apps);
        reply({ ok: true });
      });
      return true;

    case 'CHECK_PROXY':
      IMAP.isProxyRunning().then(running => reply({ running }));
      return true;
  }

});




//main scanning logic
async function runScan() {

  const config = await getConfig();

  //if imap config not set we cant really do anything
  if (!config?.host || !config?.user || !config?.pass) {
    console.warn('[Graveyard] No IMAP config set — skipping scan.');
    return;
  }


  const proxyUp = await IMAP.isProxyRunning();

  //proxy must be running otherwise backend cant talk to imap
  if (!proxyUp) {
    console.warn('[Graveyard] Local proxy not running at', IMAP.PROXY_URL);
    setBadge('!', '#ef4444');
    return;
  }


  let sessionId;

  try {

    const session = await IMAP.connect(config);
    sessionId = session.sessionId;


        //trying to fetch only newer emails so scan is faster
    const lastScan = config.lastScan ? new Date(config.lastScan) : null;

    const { emails } = await IMAP.fetchEmails(sessionId, {
      since: lastScan,
      limit: 200
    });

    console.log(`[Graveyard] Fetched ${emails.length} emails.`);


    const existing = await getApps();
    const existingIds = new Set(existing.map(a => a.id));

    const newApps = [];


    for (const email of emails) {

      if (existingIds.has(email.id)) continue;

      //classifier checks if mail is job related
      if (!CLASSIFIER.isJobEmail(email)) continue;

      const { status, confidence } = CLASSIFIER.classify(email);
      const company = CLASSIFIER.extractCompany(email);


      newApps.push({
        id: email.id,
        company,
        subject: email.subject,
        from: email.from,
        fromName: email.fromName,
        date: email.date,
        status,
        confidence,
        scannedAt: new Date().toISOString()
      });

    }



    if (newApps.length > 0) {

      const all = [...existing, ...newApps];

      await saveApps(all);

      updateBadge(all);

      notifyNewResults(newApps);

      console.log(`[Graveyard] Saved ${newApps.length} new job emails.`);
    }


    //saving last scan time so next fetch only gets newer mails
    await saveConfig({ ...config, lastScan: new Date().toISOString() });

  }

  catch (err) {

    console.error('[Graveyard] Scan error:', err);

    setBadge('!', '#ef4444');
  }

  finally {

    if (sessionId) await IMAP.disconnect(sessionId);
  }

}




//reading stored emails
function getApps() {

  return new Promise(resolve => {
    chrome.storage.local.get(STORE_KEY, data => resolve(data[STORE_KEY] || []));
  });

}



function saveApps(apps) {

  return new Promise(resolve => {
    chrome.storage.local.set({ [STORE_KEY]: apps }, resolve);
  });

}



//load imap config
function getConfig() {

  return new Promise(resolve => {
    chrome.storage.local.get(CONFIG_KEY, data => resolve(data[CONFIG_KEY] || null));
  });

}



function saveConfig(cfg) {

  return new Promise(resolve => {
    chrome.storage.local.set({ [CONFIG_KEY]: cfg }, resolve);
  });

}




//badge logic for extension icon
function updateBadge(apps) {

  const pending  = apps.filter(a => a.status === 'ack' || a.status === 'unknown').length;
  const rejected = apps.filter(a => a.status === 'rejected').length;
  const good     = apps.filter(a => ['interview', 'offer'].includes(a.status)).length;


  //show green if something good like interview or offer
  if (good > 0) {

    setBadge(String(good), '#22c55e');

  }

  else if (rejected > 0) {

    setBadge(String(apps.length), '#6366f1');

  }

  else {

    setBadge(String(apps.length), '#6366f1');
  }

}



function setBadge(text, color) {

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });

}




//notification for new results
function notifyNewResults(newApps) {

  const interviews = newApps.filter(a => a.status === 'interview');
  const offers     = newApps.filter(a => a.status === 'offer');
  const rejections = newApps.filter(a => a.status === 'rejected');


  let title = '🪦 Graveyard Update';
  let message = '';


  if (offers.length)     message += `🎉 ${offers.length} offer(s)! `;
  if (interviews.length) message += `📅 ${interviews.length} interview invite(s). `;
  if (rejections.length) message += `${rejections.length} rejection(s).`;


  if (!message) message = `${newApps.length} new application email(s) found.`;


  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message: message.trim()
  });

}