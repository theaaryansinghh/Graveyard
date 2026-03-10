// ─────────────────────────────────────────────
//  JobTracker — csv.js
//  Build & trigger CSV download
// ─────────────────────────────────────────────

const CSV = (() => {

  const HEADERS = [
    'Company', 'Subject', 'Status', 'Confidence',
    'Date Received', 'Sender Email', 'Email ID'
  ];

  const STATUS_LABELS = {
    rejected: 'Rejected',
    interview: 'Interview / Next Step',
    offer: 'Offer 🎉',
    ack: 'Acknowledgement',
    unknown: 'Unknown'
  };

  function escape(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function row(fields) {
    return fields.map(escape).join(',');
  }

  function build(applications) {
    const lines = [row(HEADERS)];
    for (const app of applications) {
      lines.push(row([
        app.company,
        app.subject,
        STATUS_LABELS[app.status] || app.status,
        app.confidence,
        app.date ? new Date(app.date).toLocaleDateString() : '',
        app.from,
        app.id
      ]));
    }
    return lines.join('\n');
  }

  function download(applications, filename) {
    const content = build(applications);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const name = filename || `jobtracker_${new Date().toISOString().slice(0, 10)}.csv`;

    chrome.downloads.download({
      url,
      filename: name,
      saveAs: false
    }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  return { build, download };
})();

if (typeof module !== 'undefined') module.exports = CSV;