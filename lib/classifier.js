// ─────────────────────────────────────────────
//  JobTracker — classifier.js
//  Keyword/regex engine for email classification
// ─────────────────────────────────────────────

const CLASSIFIER = (() => {

  // ── Status buckets ──────────────────────────
  const PATTERNS = {
    rejected: {
      subject: [
        /we('ve| have) decided (not |to move forward with other)/i,
        /not (selected|moving forward|proceeding)/i,
        /unfortunately|regret to inform|regrettably/i,
        /position has been filled/i,
        /we will not be moving/i,
        /not a (fit|match) (at this time)?/i,
        /application.*unsuccessful/i,
        /decided to pursue (other|another)/i,
        /no longer (considering|moving forward)/i,
      ],
      body: [
        /we('ve| have) decided (not |to move forward with other)/i,
        /unfortunately.*not.*moving forward/i,
        /we will not be (moving|proceeding)/i,
        /after careful (review|consideration).*not selected/i,
        /regret to inform you/i,
        /we('ve| have) chosen (to pursue )?other candidates/i,
        /position has been filled/i,
        /not (selected|moving forward|proceeding) with your application/i,
        /decided to pursue another candidate/i,
        /application.*not been successful/i,
        /not moving forward with your candidacy/i,
        /we('re| are) not able to offer you/i,
      ]
    },

    interview: {
      subject: [
        /interview (invite|invitation|request|scheduled)/i,
        /schedule (a |an )?(call|interview|chat|meeting)/i,
        /next (steps?|round|stage)/i,
        /moving (you )?forward/i,
        /would like to (speak|talk|connect|meet)/i,
        /phone (screen|call|interview)/i,
        /technical (screen|interview|assessment)/i,
        /coding (challenge|assessment|interview)/i,
      ],
      body: [
        /we('d| would) like to (invite|schedule|set up)/i,
        /move (you )?forward to the next (round|stage|step)/i,
        /schedule (a |an )?(call|interview|meeting|chat)/i,
        /pleased to invite you/i,
        /selected (you )?for (an? )?(interview|next round)/i,
        /like to (speak|connect|meet) with you/i,
        /phone (screen|interview)/i,
        /technical (screen|round|interview)/i,
        /please (complete|finish|take) (this |the )?(assessment|challenge|test)/i,
        /hackerrank|codility|leetcode|codesignal/i,
      ]
    },

    offer: {
      subject: [
        /offer (letter|of employment)?/i,
        /congratulations.*offer/i,
        /pleased to offer/i,
        /job offer/i,
        /internship offer/i,
      ],
      body: [
        /pleased to (extend|offer) (you )?(an? )?offer/i,
        /offer of employment/i,
        /offer letter/i,
        /start date.*compensation/i,
        /we('re| are) excited to offer/i,
        /congratulations.*joining/i,
      ]
    },

    ack: {
      subject: [
        /thank you for (applying|your application|your interest)/i,
        /application received/i,
        /we received your application/i,
        /application (confirmation|confirmed)/i,
      ],
      body: [
        /thank you for (applying|submitting|your application)/i,
        /we('ve| have) received your application/i,
        /your application (has been|was) (received|submitted)/i,
        /we will (be in touch|review|get back)/i,
        /keep your (application|profile) on file/i,
      ]
    }
  };

  // ── Job-related email detector ───────────────
  const JOB_SIGNALS = {
    subject: [
      /application/i, /position/i, /role/i, /internship/i,
      /job/i, /career/i, /opportunity/i, /candidacy/i,
      /recruitment/i, /hiring/i,
    ],
    body: [
      /applied (for|to)/i, /your application/i, /candidate/i,
      /hiring (process|team|manager)/i, /recruiter/i,
      /job description/i, /compensation/i, /benefits package/i,
    ],
    // Common ATS / recruiting platforms in sender domain
    senderDomains: [
      'greenhouse.io', 'lever.co', 'workday.com', 'taleo.net',
      'icims.com', 'jobvite.com', 'smartrecruiters.com', 'breezy.hr',
      'ashbyhq.com', 'recruitee.com', 'bamboohr.com', 'jazz.co',
      'hiringthing.com', 'myworkdayjobs.com', 'successfactors.com',
      'oraclecloud.com', 'linkedin.com', 'indeed.com', 'glassdoor.com',
      'ziprecruiter.com',
    ]
  };

  function matchesAny(text, patterns) {
    return patterns.some(p => p.test(text));
  }

  function isJobEmail(email) {
    const subject = email.subject || '';
    const body = email.body || '';
    const sender = email.from || '';

    // Check ATS sender domain
    const senderLower = sender.toLowerCase();
    if (JOB_SIGNALS.senderDomains.some(d => senderLower.includes(d))) return true;

    // Subject or body signals
    if (matchesAny(subject, JOB_SIGNALS.subject)) return true;
    if (matchesAny(body, JOB_SIGNALS.body)) return true;

    return false;
  }

  function classify(email) {
    const subject = email.subject || '';
    const body = email.body || '';

    for (const [status, { subject: sPatterns, body: bPatterns }] of Object.entries(PATTERNS)) {
      const subjectHit = matchesAny(subject, sPatterns);
      const bodyHit = matchesAny(body, bPatterns);
      if (subjectHit || bodyHit) {
        return {
          status,
          confidence: subjectHit && bodyHit ? 'high' : 'medium',
          matchedIn: [subjectHit && 'subject', bodyHit && 'body'].filter(Boolean)
        };
      }
    }

    return { status: 'unknown', confidence: 'low', matchedIn: [] };
  }

  // ── Extract company name heuristic ──────────
  function extractCompany(email) {
    // Try sender name first: "John from Acme Corp <john@acmecorp.com>"
    const fromName = (email.fromName || '').trim();
    if (fromName) {
      // Strip common patterns: "Recruiting Team at X", "X Careers", etc.
      const atMatch = fromName.match(/(?:from|at|@)\s+(.+)/i);
      if (atMatch) return atMatch[1].trim();
      // If it looks like a company not a person (no space = likely domain/company)
      if (!fromName.includes(' ')) return fromName;
    }

    // Fallback: extract domain from sender email
    const emailMatch = (email.from || '').match(/@([^>]+)/);
    if (emailMatch) {
      const domain = emailMatch[1].toLowerCase();
      // Strip common subdomains and TLDs
      return domain
        .replace(/^(mail|email|careers|recruiting|hr|jobs|noreply|no-reply)\./i, '')
        .replace(/\.(com|io|co|org|net|ai|dev)(\..*)?$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    return 'Unknown Company';
  }

  return { classify, isJobEmail, extractCompany };
})();

if (typeof module !== 'undefined') module.exports = CLASSIFIER;