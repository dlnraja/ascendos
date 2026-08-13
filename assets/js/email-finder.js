/**
 * Email Finder — guess RH / chef de projet emails from:
 * - company domain
 * - observed employee email nomenclatures (public samples)
 * - LinkedIn first/last names
 *
 * Local-first. No scraping backend. User pastes public samples + names.
 */
const EmailFinder = (() => {
  const PATTERNS = [
    { id: "first.last", label: "prenom.nom", build: (f, l) => `${f}.${l}` },
    { id: "firstlast", label: "prenomnom", build: (f, l) => `${f}${l}` },
    { id: "f.last", label: "p.nom", build: (f, l) => `${f[0]}.${l}` },
    { id: "flast", label: "pnom", build: (f, l) => `${f[0]}${l}` },
    { id: "last.first", label: "nom.prenom", build: (f, l) => `${l}.${f}` },
    { id: "lastf", label: "nomp", build: (f, l) => `${l}${f[0]}` },
    { id: "first_last", label: "prenom_nom", build: (f, l) => `${f}_${l}` },
    { id: "first-last", label: "prenom-nom", build: (f, l) => `${f}-${l}` },
    { id: "first", label: "prenom", build: (f) => `${f}` },
    { id: "last", label: "nom", build: (_f, l) => `${l}` },
    { id: "f_last", label: "p_nom", build: (f, l) => `${f[0]}_${l}` },
    { id: "first.l", label: "prenom.n", build: (f, l) => `${f}.${l[0]}` },
  ];

  const ROLE_HINTS = {
    hr: ["rh", "hr", "recrut", "talent", "people", "drh", "acquisition", "mobilité"],
    pm: ["chef de projet", "project manager", "delivery", "responsable projet", "program manager", "pmo"],
    hiring_manager: ["manager", "lead", "head of", "directeur", "responsable", "engineering manager"],
    recruiter: ["recruiter", "sourcer", "chasse", "staffing"],
  };

  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function slugKeepDot(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9._-]+/g, "")
      .replace(/\.+/g, ".")
      .replace(/^[\s._-]+|[\s._-]+$/g, "");
  }

  /** Parse "Marie-Claire Dupont" / "Jean de La Fontaine" from LinkedIn */
  function parsePersonName(fullName) {
    const cleaned = String(fullName || "")
      .replace(/\(.*?\)/g, " ")
      .replace(/,.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return { first: "", last: "", middle: [], raw: "" };

    const parts = cleaned.split(" ").filter(Boolean);
    const particles = new Set(["de", "du", "des", "la", "le", "van", "von", "da", "di", "del", "della"]);

    if (parts.length === 1) {
      return { first: slug(parts[0]), last: slug(parts[0]), middle: [], raw: cleaned };
    }

    const first = slug(parts[0]);
    let last;
    if (parts.length === 2) {
      last = slug(parts[1]);
    } else {
      last = slug(parts.slice(1).join(" "));
      if (last.length > 18) last = slug(parts[parts.length - 1]);
    }

    const middle = parts.slice(1, -1).map(slug).filter(Boolean);
    return { first, last, middle, raw: cleaned, firstRaw: parts[0], lastRaw: parts[parts.length - 1] };
  }

  function extractEmails(text) {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(String(text || "").match(re) || [])].map((e) => e.toLowerCase());
  }

  function domainFromEmail(email) {
    const m = String(email || "").toLowerCase().match(/@([^@\s]+)$/);
    return m ? m[1] : "";
  }

  function normalizeDomain(input) {
    let d = String(input || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0];
    return d;
  }

  function guessDomainFromCompany(company) {
    const c = slug(company);
    if (!c) return "";
    // Heuristic only — user should confirm
    return `${c}.com`;
  }

  /**
   * Infer which pattern a sample email uses given a known person name.
   * Returns ranked pattern matches.
   */
  function inferPatternFromSample(email, fullName) {
    const local = String(email).split("@")[0] || "";
    const { first, last } = parsePersonName(fullName);
    if (!first || !last || !local) return null;

    const hits = [];
    for (const p of PATTERNS) {
      const built = p.build(first, last);
      if (local === built) {
        hits.push({ patternId: p.id, label: p.label, confidence: 0.95 });
      } else if (local.startsWith(built) || built.startsWith(local)) {
        hits.push({ patternId: p.id, label: p.label, confidence: 0.55 });
      }
    }
    hits.sort((a, b) => b.confidence - a.confidence);
    return hits[0] || null;
  }

  /**
   * Learn domain patterns from a paste of public employee emails + optional "Name <email>" lines.
   * Lines formats:
   *   marie.dupont@acme.com
   *   Marie Dupont <marie.dupont@acme.com>
   *   Marie Dupont, marie.dupont@acme.com
   */
  function learnFromPublicSamples(paste) {
    const lines = String(paste || "").split(/\r?\n/);
    const byDomain = {};

    for (const line of lines) {
      const emails = extractEmails(line);
      if (!emails.length) continue;
      const email = emails[0];
      const domain = domainFromEmail(email);
      if (!domain) continue;

      let nameGuess = "";
      const angle = line.match(/^([^<]+)</);
      const comma = line.match(/^([^,@]+),/);
      if (angle) nameGuess = angle[1].trim();
      else if (comma && !comma[1].includes("@")) nameGuess = comma[1].trim();

      // Reverse-guess name from local part if no name
      const local = email.split("@")[0];
      let inferred = null;
      if (nameGuess) {
        inferred = inferPatternFromSample(email, nameGuess);
      } else if (local.includes(".")) {
        const [f, l] = local.split(".");
        inferred = { patternId: "first.last", label: "prenom.nom", confidence: 0.7, syntheticName: `${f} ${l}` };
      } else if (local.includes("_")) {
        inferred = { patternId: "first_last", label: "prenom_nom", confidence: 0.65 };
      } else if (local.includes("-")) {
        inferred = { patternId: "first-last", label: "prenom-nom", confidence: 0.65 };
      }

      if (!byDomain[domain]) {
        byDomain[domain] = { domain, samples: [], patternVotes: {}, confidence: 0 };
      }
      byDomain[domain].samples.push({ email, name: nameGuess || null, at: Date.now() });
      if (inferred?.patternId) {
        const prev = byDomain[domain].patternVotes[inferred.patternId] || 0;
        byDomain[domain].patternVotes[inferred.patternId] = prev + (inferred.confidence || 0.5);
      }
    }

    for (const d of Object.values(byDomain)) {
      const votes = Object.entries(d.patternVotes).sort((a, b) => b[1] - a[1]);
      d.topPattern = votes[0]?.[0] || "first.last";
      d.topLabel = PATTERNS.find((p) => p.id === d.topPattern)?.label || d.topPattern;
      d.confidence = votes[0] ? Math.min(0.98, votes[0][1] / Math.max(1, d.samples.length)) : 0.4;
      d.patternRanking = votes.map(([id, score]) => ({
        id,
        label: PATTERNS.find((p) => p.id === id)?.label || id,
        score,
      }));
    }

    return byDomain;
  }

  function generateCandidates({ firstName, lastName, fullName, domain, preferredPatternId, learned }) {
    const parsed = fullName ? parsePersonName(fullName) : { first: slug(firstName), last: slug(lastName) };
    const first = parsed.first;
    const last = parsed.last;
    const dom = normalizeDomain(domain);
    if (!first || !last || !dom) return [];

    const preferred =
      preferredPatternId ||
      learned?.[dom]?.topPattern ||
      "first.last";

    const out = [];
    const seen = new Set();

    const ordered = [
      ...PATTERNS.filter((p) => p.id === preferred),
      ...PATTERNS.filter((p) => p.id !== preferred),
    ];

    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const local = p.build(first, last);
      if (!local) continue;
      const email = `${local}@${dom}`;
      if (seen.has(email)) continue;
      seen.add(email);
      const isPreferred = p.id === preferred;
      const conf = isPreferred
        ? learned?.[dom]?.confidence
          ? Math.round(learned[dom].confidence * 100)
          : 82
        : Math.max(25, 70 - i * 5);
      out.push({
        email,
        patternId: p.id,
        patternLabel: p.label,
        confidence: conf,
        rank: out.length + 1,
        preferred: isPreferred,
      });
    }

    // Generic role mailboxes (RH / recrutement) — useful alongside personal emails
    const roleBoxes = [
      "rh",
      "recrutement",
      "recruitment",
      "talent",
      "careers",
      "jobs",
      "carrieres",
      "hr",
      "emploi",
    ].map((local, idx) => ({
      email: `${local}@${dom}`,
      patternId: "rolebox",
      patternLabel: `boîte ${local}`,
      confidence: Math.max(20, 48 - idx * 3),
      rank: 100 + idx,
      preferred: false,
      roleMailbox: true,
    }));

    return [...out, ...roleBoxes];
  }

  function detectRole(title) {
    const t = String(title || "").toLowerCase();
    for (const [role, hints] of Object.entries(ROLE_HINTS)) {
      if (hints.some((h) => t.includes(h))) return role;
    }
    return "contact";
  }

  function roleLabel(role) {
    return (
      {
        hr: "RH / Talent",
        pm: "Chef de projet / Delivery",
        hiring_manager: "Hiring manager",
        recruiter: "Recruteur",
        contact: "Contact",
      }[role] || role
    );
  }

  /**
   * Build dual outreach: ATS CRM note + direct email to guessed contacts.
   */
  function buildDualOutreach({ profile, job, contact, email }) {
    const name = profile.fullName || "candidat";
    const role = job?.title || "le poste";
    const company = job?.company || "votre entreprise";
    const contactFirst = (contact?.fullName || "").split(" ")[0] || "";
    const hello = contactFirst ? `Bonjour ${contactFirst},` : "Bonjour,";

    return {
      subject: `${role} — candidature ${name} (en complément du CRM)`,
      body: `${hello}

Je vous écris en complément de ma candidature déposée sur votre outil de recrutement / ATS concernant « ${role} » chez ${company}.

Profil : ${profile.headline || "en transition vers un poste internalisé / client final"}.

${(profile.summary || "").slice(0, 380)}

Je cherche un échange court (15 min) avec un RH ou un chef de projet / hiring manager pour mieux comprendre le besoin — au-delà du formulaire CRM.

Bien cordialement,
${name}
${profile.email || ""}
${profile.linkedinUrl || ""}`,
      to: email,
    };
  }

  return {
    PATTERNS,
    parsePersonName,
    extractEmails,
    domainFromEmail,
    normalizeDomain,
    guessDomainFromCompany,
    inferPatternFromSample,
    learnFromPublicSamples,
    generateCandidates,
    detectRole,
    roleLabel,
    buildDualOutreach,
  };
})();

window.EmailFinder = EmailFinder;
