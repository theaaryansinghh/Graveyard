# Contributing to Graveyard

Thanks for wanting to contribute. Every rejection email phrase you add makes it better for everyone grinding through applications.

## Easiest way to contribute

If a job email wasn't classified correctly, open `lib/classifier.js` and add the phrase to the right array. No setup needed.

## Setup

```bash
git clone https://github.com/theaaryansinghh/Graveyard
cd Graveyard/proxy && npm install && node server.js
```

Load the extension in `chrome://extensions` → Developer Mode → Load unpacked.

## What's worth contributing

- Classifier patterns (real rejection/interview phrases that get missed)
- ATS domains not in the `senderDomains` list
- Bug fixes (check open issues first)

## Submitting a PR

Fork, branch, change, test, PR. Keep the description short. Don't add dependencies without a reason. Don't break the offline-first approach.

## Reporting a bug

Open an issue with what happened, your email provider, and any errors from the proxy terminal or popup DevTools console.
