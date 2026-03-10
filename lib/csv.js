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

  //csv needs escaping if commas or quotes appear
  function escape(val) {

    const s = String(val ?? '');

    if (s.includes(',') || s.includes('"') || s.includes('\n')) {

      return `"${s.replace(/"/g, '""')}"`;

    }

    return s;
  }

  //joins fields into one csv row
  function row(fields) {

    return fields.map(escape).join(',');

  }


  //builds the csv text
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

  //triggers chrome download
  function download(applications, filename) {

    const content = build(applications);

    const name = filename || `jobtracker_${new Date().toISOString().slice(0, 10)}.csv`;

    const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);


    chrome.downloads.download({
      url: dataUrl,
      filename: name,
      saveAs: false
    });

  }

  return { build, download };

})();


if (typeof module !== 'undefined') module.exports = CSV;