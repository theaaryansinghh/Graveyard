# 🪦 Graveyard

> 7 rejections at once is easier than opening 7 emails one by one.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-222?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-222?style=flat-square) ![IMAP](https://img.shields.io/badge/Email-IMAP-222?style=flat-square)

A Chrome extension that scans your inbox for job application replies, classifies them (buried / alive / risen), and shows them in one place. Exports to CSV. Runs fully offline, nothing leaves your machine.

---

## Setup

**1. Start the proxy** (keeps running in the background)
```bash
cd proxy && npm install && node server.js
```

**2. Load the extension**
- Go to `chrome://extensions` → enable Developer Mode → Load unpacked → select this folder

**3. Enter your IMAP credentials** via the ⚙ icon

| Provider | Host | Port |
|----------|------|------|
| Gmail | `imap.gmail.com` | 993 |
| Outlook | `outlook.office365.com` | 993 |
| Yahoo | `imap.mail.yahoo.com` | 993 |
| Fastmail | `imap.fastmail.com` | 993 |

**Passwords:**
- **Gmail** — requires an [App Password](https://myaccount.google.com/apppasswords), real password won't work
- **Yahoo** — also requires an [App Password](https://login.yahoo.com/account/security), same deal
- **Outlook** — regular password works, unless you have 2FA enabled (then generate one [here](https://account.microsoft.com/security))
- **Fastmail** — regular password works
---

## Troubleshooting

**`!` badge on the icon**
The proxy isn't running. Start it with `node proxy/server.js` and keep that terminal open.

**Timed out while connecting**
Your network is blocking port 993. Common on home ISPs and university networks. Try a VPN or mobile hotspot — if it works there, that's the issue. You can also try port 143 with TLS set to `no`, though most providers require 993.

**Wrong host error in proxy terminal**
Double-check the IMAP host. Gmail is `imap.gmail.com`, not `imap.google.com`.

**Emails scanned but nothing classified**
The classifier uses keyword matching. If a company sends vague replies that don't contain standard phrases, they'll show up as `unknown`. You can add patterns in `lib/classifier.js`.

**`URL.createObjectURL` error on CSV export**
Reload the extension from `chrome://extensions` after any file changes.

---

## Privacy

Credentials stored in `chrome.storage.local`. Proxy binds to `127.0.0.1` only. No external requests, no telemetry.

---

MIT
