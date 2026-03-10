const CONFIG_KEY = 'jobtracker_config';
let allApps = [];
let activeFilter = 'all';

const STATUS_LABELS = {
  rejected:  'No',
  interview: 'Interview',
  offer:     'Offer 🎉',
  ack:       'Received',
  unknown:   'Unknown'
};



//page loads everything from here
document.addEventListener('DOMContentLoaded', async () => {
  await loadApps();
  await checkProxy();
  loadConfig();
  bindEvents();
});


//getting all emails saved and sorting by date
async function loadApps() {
  const res = await msg({ type: 'GET_APPS' });
  allApps = (res.apps || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  renderStats();
  renderList();
}



function renderStats() {
  const counts = {
    total:     allApps.length,
    rejected:  allApps.filter(a => a.status === 'rejected').length,
    interview: allApps.filter(a => a.status === 'interview').length,
    offer:     allApps.filter(a => a.status === 'offer').length,
  };

  document.getElementById('count-total').textContent    = counts.total;
  document.getElementById('count-rejected').textContent = counts.rejected;
  document.getElementById('count-interview').textContent = counts.interview;
  document.getElementById('count-offer').textContent    = counts.offer;
}



//this renders the emails list depending on filter selected
function renderList(filter) {
  if (filter !== undefined) activeFilter = filter;

  const list = document.getElementById('email-list');
  const label = document.getElementById('list-label');

  const filtered = activeFilter === 'all'
    ? allApps
    : allApps.filter(a => a.status === activeFilter);

  const filterNames = { all: 'All Emails', rejected: 'Rejections', interview: 'Interviews', offer: 'Offers' };
  label.textContent = filterNames[activeFilter] || 'Emails';

  document.querySelectorAll('.stat').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === activeFilter);
  });


  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${activeFilter === 'all' ? '📭' : '🔍'}</div>
        <div class="empty-text">${allApps.length === 0
          ? 'No job emails tracked yet.<br>Hit <strong>Scan Now</strong> to start.'
          : 'No emails in this category.'
        }</div>
      </div>`;
    return;
  }


  list.innerHTML = filtered.map(app => `
    <div class="email-card">
      <div class="status-dot dot-${app.status}"></div>
      <div class="email-info">
        <div class="email-company">${esc(app.company)}</div>
        <div class="email-subject">${esc(app.subject || '(no subject)')}</div>
      </div>
      <div class="email-meta">
        <div class="email-date">${formatDate(app.date)}</div>
        <span class="status-chip chip-${app.status}">${STATUS_LABELS[app.status] || app.status}</span>
      </div>
    </div>
  `).join('');
}



//checking if proxy server is running or not
async function checkProxy() {
  const { running } = await msg({ type: 'CHECK_PROXY' });
  document.getElementById('proxy-warn').style.display = running ? 'none' : 'block';
}




//loading saved imap config from storage
function loadConfig() {
  chrome.storage.local.get(CONFIG_KEY, data => {
    const cfg = data[CONFIG_KEY] || {};

    document.getElementById('cfg-host').value = cfg.host || '';
    document.getElementById('cfg-port').value = cfg.port || 993;
    document.getElementById('cfg-tls').value  = cfg.tls !== false ? 'yes' : 'no';
    document.getElementById('cfg-user').value = cfg.user || '';
  });
}



//saving config user entered
function saveConfig() {
  const config = {
    host: document.getElementById('cfg-host').value.trim(),
    port: parseInt(document.getElementById('cfg-port').value) || 993,
    tls:  document.getElementById('cfg-tls').value.trim().toLowerCase() !== 'no',
    user: document.getElementById('cfg-user').value.trim(),
    pass: document.getElementById('cfg-pass').value,
  };

  if (!config.host || !config.user || !config.pass) {
    showSaveMsg('Please fill in all fields.', true);
    return;
  }

  chrome.storage.local.set({ [CONFIG_KEY]: config }, () => {
    showSaveMsg('Saved! ✓');
    setTimeout(toggleSettings, 800);
  });
}



function showSaveMsg(text, isError = false) {
  const el = document.getElementById('save-msg');
  el.textContent = text;
  el.style.color = isError ? 'var(--red)' : 'var(--green)';
}



//switch between dashboard and settings panel
function toggleSettings() {
  const dash = document.getElementById('dashboard');
  const panel = document.getElementById('settings-panel');

  const isOpen = panel.style.display === 'block';

  dash.style.display  = isOpen ? 'block' : 'none';
  panel.style.display = isOpen ? 'none'  : 'block';
}




//manual scan button logic
async function scanNow() {
  const btn = document.getElementById('scan-btn');

  btn.innerHTML = '<span class="spin">↻</span> Scanning…';
  btn.disabled = true;

  await msg({ type: 'SCAN_NOW' });
  await loadApps();
  await checkProxy();

  btn.textContent = 'Scan Now';
  btn.disabled = false;
}




//binding all button clicks here
function bindEvents() {

  document.getElementById('scan-btn').addEventListener('click', scanNow);
  document.getElementById('settings-btn').addEventListener('click', toggleSettings);
  document.getElementById('cancel-settings').addEventListener('click', toggleSettings);
  document.getElementById('save-settings').addEventListener('click', saveConfig);

  document.getElementById('export-btn').addEventListener('click', () => msg({ type: 'EXPORT_CSV' }));


  document.getElementById('clear-btn').addEventListener('click', async () => {
    if (confirm('Clear all tracked emails?')) {
      await msg({ type: 'CLEAR_APPS' });
      allApps = [];
      renderStats();
      renderList();
    }
  });


  document.querySelectorAll('.stat').forEach(el => {
    el.addEventListener('click', () => renderList(el.dataset.filter));
  });
}




//small helper to send message to background
function msg(payload) {
  return new Promise(resolve => chrome.runtime.sendMessage(payload, resolve));
}



//escaping html so subject/company dont break layout
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}



//formatting email date nicer for ui
function formatDate(dateStr) {

  if (!dateStr) return '—';

  const d = new Date(dateStr);
  const now = new Date();

  const diffDays = Math.floor((now - d) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}