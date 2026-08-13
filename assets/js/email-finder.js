/**
 * Email Finder — Hunter/Apollo-inspired (local + free APIs)
 * - Permutator (all common formats)
 * - Learn patterns from public samples / commercial business cards / vCard
 * - Optional Hunter.io free API (50 searches/mo with user key)
 * - MX check via DNS-over-HTTPS (domain validity, not mailbox verify)
 *
 * No illegal scraping. Guesses ≠ verified emails — dual outreach with care.
 */
const EmailFinder = (() => {
  const PATTERNS = [
    { id: "first.last", label: "prenom.nom", build: (f, l, m) => `${f}.${l}`, rank: 1 },
    { id: "flast", label: "pnom", build: (f, l) => `${f[0]}${l}`, rank: 2 },
    { id: "f.last", label: "p.nom", build: (f, l) => `${f[0]}.${l}`, rank: 3 },
    { id: "firstlast", label: "prenomnom", build: (f, l) => `${f}${l}`, rank: 4 },
    { id: "first", label: "prenom", build: (f) => `${f}`, rank: 5 },
    { id: "last.first", label: "nom.prenom", build: (f, l) => `${l}.${f}`, rank: 6 },
    { id: "first_last", label: "prenom_nom", build: (f, l) => `${f}_${l}`, rank: 7 },
    { id: "first-last", label: "prenom-nom", build: (f, l) => `${f}-${l}`, rank: 8 },
    { id: "lastf", label: "nomp", build: (f, l) => `${l}${f[0]}`, rank: 9 },
    { id: "last", label: "nom", build: (_f, l) => `${l}`, rank: 10 },
    { id: "f_last", label: "p_nom", build: (f, l) => `${f[0]}_${l}`, rank: 11 },
    { id: "first.l", label: "prenom.n", build: (f, l) => `${f}.${l[0]}`, rank: 12 },
    { id: "f.l", label: "p.n", build: (f, l) => `${f[0]}.${l[0]}`, rank: 13 },
    {
      id: "first.m.last",
      label: "prenom.m.nom",
      build: (f, l, m) => (m ? `${f}.${m[0]}.${l}` : null),
      rank: 14,
    },
    {
      id: "fm.last",
      label: "pm.nom",
      build: (f, l, m) => (m ? `${f[0]}${m[0]}.${l}` : null),
      rank: 15,
    },
    { id: "last.first", label: "nom.prenom", build: (f, l) => `${l}.${f}`, rank: 6 },
  ];

  // Deduplicate patterns by id
  const PATTERN_LIST = [...new Map(PATTERNS.map((p) => [p.id, p])).values()].sort(
    (a, b) => (a.rank || 99) - (b.rank || 99)
  );

  const ROLE_HINTS = {
    hr: ["rh", "hr", "recrut", "talent", "people", "drh", "acquisition", "mobilité"],
    pm: ["chef de projet", "project manager", "delivery", "responsable projet", "program manager", "pmo"],
    hiring_manager: ["manager", "lead", "head of", "directeur", "responsable", "engineering manager"],
    recruiter: ["recruiter", "sourcer", "chasse", "staffing"],
    sales: ["commercial", "sales", "account", "business develop", "adv", "chargé d'affaires"],
  };

  const FREE_TOOLS = [
    { id: "hunter", label: "Hunter.io", free: "50 searches/mois", url: "https://hunter.io/users/sign_up" },
    { id: "apollo", label: "Apollo.io", free: "crédits email/mois", url: "https://www.apollo.io/email-finder" },
    { id: "permutator", label: "Permutator local", free: "illimité (guess)", url: null },
    { id: "mx", label: "MX DNS (Cloudflare DoH)", free: "illimité", url: null },
  ];

  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function parsePersonName(fullName) {
    const cleaned = String(fullName || "")
      .replace(/\(.*?\)/g, " ")
      .replace(/,.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return { first: "", last: "", middle: [], raw: "" };

    const parts = cleaned.split(" ").filter(Boolean);
    if (parts.length === 1) {
      return { first: slug(parts[0]), last: slug(parts[0]), middle: [], raw: cleaned };
    }

    const first = slug(parts[0]);
    let last;
    let middle = [];
    if (parts.length === 2) {
      last = slug(parts[1]);
    } else {
      middle = parts.slice(1, -1).map(slug).filter(Boolean);
      last = slug(parts[parts.length - 1]);
      const joined = slug(parts.slice(1).join(" "));
      if (joined.length <= 18) last = joined;
    }
    return { first, last, middle, raw: cleaned, firstRaw: parts[0], lastRaw: parts[parts.length - 1] };
  }

  function extractEmails(text) {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(String(text || "").match(re) || [])].map((e) => e.toLowerCase());
  }

  function extractPhones(text) {
    const re = /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
    return [...new Set(String(text || "").match(re) || [])];
  }

  function extractUrls(text) {
    const re = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi;
    return [...new Set(String(text || "").match(re) || [])];
  }

  function domainFromEmail(email) {
    const m = String(email || "")
      .toLowerCase()
      .match(/@([^@\s]+)$/);
    return m ? m[1] : "";
  }

  function normalizeDomain(input) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0];
  }

  function guessDomainFromCompany(company) {
    const c = slug(company);
    if (!c) return "";
    // FR bias: try .fr first as suggestion list
    return `${c}.fr`;
  }

  function guessDomainsFromCompany(company) {
    const c = slug(company);
    if (!c) return [];
    return [`${c}.fr`, `${c}.com`, `${c}.eu`, `groupe-${c}.fr`, `${c}.group`];
  }

  function inferPatternFromSample(email, fullName) {
    const local = String(email).split("@")[0] || "";
    const { first, last, middle } = parsePersonName(fullName);
    if (!first || !last || !local) return null;
    const mid = middle[0] || "";
    const hits = [];
    for (const p of PATTERN_LIST) {
      const built = p.build(first, last, mid);
      if (!built) continue;
      if (local === built) hits.push({ patternId: p.id, label: p.label, confidence: 0.95 });
      else if (local.startsWith(built) || built.startsWith(local))
        hits.push({ patternId: p.id, label: p.label, confidence: 0.55 });
    }
    hits.sort((a, b) => b.confidence - a.confidence);
    return hits[0] || null;
  }

  /**
   * Parse business card / commercial signature / vCard paste.
   * Inspired by how sales tools ingest cards + Hunter pattern learning.
   */
  function parseBusinessCard(raw) {
    const text = String(raw || "").trim();
    const out = {
      fullName: "",
      title: "",
      company: "",
      emails: [],
      phones: [],
      domain: "",
      website: "",
      linkedin: "",
      source: "card",
    };

    if (!text) return out;

    // vCard
    if (/BEGIN:VCARD/i.test(text)) {
      const fn = text.match(/FN[;:]([^\r\n]+)/i);
      const org = text.match(/ORG[;:]([^\r\n]+)/i);
      const title = text.match(/TITLE[;:]([^\r\n]+)/i);
      const email = text.match(/EMAIL[^:]*:([^\r\n]+)/i);
      const url = text.match(/URL[^:]*:([^\r\n]+)/i);
      const tel = text.match(/TEL[^:]*:([^\r\n]+)/i);
      out.fullName = (fn?.[1] || "").replace(/\\,/g, ",").trim();
      out.company = (org?.[1] || "").split(";")[0].replace(/\\,/g, ",").trim();
      out.title = (title?.[1] || "").replace(/\\,/g, ",").trim();
      if (email) out.emails = [email[1].trim().toLowerCase()];
      if (url) out.website = url[1].trim();
      if (tel) out.phones = [tel[1].trim()];
      out.source = "vcard";
    } else {
      out.emails = extractEmails(text);
      out.phones = extractPhones(text);
      const urls = extractUrls(text);
      out.website = urls.find((u) => !/linkedin\.com/i.test(u)) || "";
      out.linkedin = urls.find((u) => /linkedin\.com/i.test(u)) || "";

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      // French / commercial card labels
      for (const line of lines) {
        const mCompany = line.match(/^(?:société|societe|company|entreprise|agence)\s*[:：]\s*(.+)$/i);
        const mTitle = line.match(/^(?:titre|fonction|poste|title|job)\s*[:：]\s*(.+)$/i);
        const mName = line.match(/^(?:nom|name|contact)\s*[:：]\s*(.+)$/i);
        if (mCompany) out.company = mCompany[1].trim();
        if (mTitle) out.title = mTitle[1].trim();
        if (mName) out.fullName = mName[1].trim();
      }

      // Heuristic: first non-email, non-phone, non-url, non-label line = name
      if (!out.fullName) {
        const skip = /^(tel|tél|portable|mobile|fax|email|mail|www|http|société|company|@)/i;
        const candidate = lines.find((l) => !skip.test(l) && !l.includes("@") && l.length < 60 && /[a-zA-ZÀ-ÿ]/.test(l));
        if (candidate) out.fullName = candidate.replace(/^(m\.|mme|mr|mrs|dr)\s+/i, "").trim();
      }

      // Second line often title or company
      if (!out.title && lines[1] && !lines[1].includes("@") && lines[1].length < 80) {
        if (/directeur|manager|commercial|responsable|consultant|engineer|chef/i.test(lines[1])) {
          out.title = lines[1];
        } else if (!out.company) {
          out.company = lines[1];
        }
      }
      if (!out.company) {
        const co = lines.find((l) => /sas|sarl|sa\b|inc|ltd|groupe|company/i.test(l) && !l.includes("@"));
        if (co) out.company = co;
      }
    }

    if (out.emails[0]) out.domain = domainFromEmail(out.emails[0]);
    else if (out.website) out.domain = normalizeDomain(out.website);

    return out;
  }

  function learnFromPublicSamples(paste) {
    // Also ingest business-card style blocks separated by blank lines
    const cards = String(paste || "").split(/\n\s*\n/);
    const byDomain = {};

    function addSample(email, nameGuess) {
      const domain = domainFromEmail(email);
      if (!domain) return;
      let inferred = null;
      if (nameGuess) inferred = inferPatternFromSample(email, nameGuess);
      else {
        const local = email.split("@")[0];
        if (local.includes(".")) inferred = { patternId: "first.last", label: "prenom.nom", confidence: 0.7 };
        else if (local.includes("_")) inferred = { patternId: "first_last", label: "prenom_nom", confidence: 0.65 };
        else if (local.includes("-")) inferred = { patternId: "first-last", label: "prenom-nom", confidence: 0.65 };
      }
      if (!byDomain[domain]) byDomain[domain] = { domain, samples: [], patternVotes: {}, confidence: 0 };
      byDomain[domain].samples.push({ email, name: nameGuess || null, at: Date.now() });
      if (inferred?.patternId) {
        byDomain[domain].patternVotes[inferred.patternId] =
          (byDomain[domain].patternVotes[inferred.patternId] || 0) + (inferred.confidence || 0.5);
      }
    }

    for (const chunk of cards) {
      const card = parseBusinessCard(chunk);
      if (card.emails.length && (card.fullName || chunk.includes("@"))) {
        for (const em of card.emails) addSample(em, card.fullName);
        continue;
      }
      for (const line of chunk.split(/\r?\n/)) {
        const emails = extractEmails(line);
        if (!emails.length) continue;
        let nameGuess = "";
        const angle = line.match(/^([^<]+)</);
        const comma = line.match(/^([^,@]+),/);
        if (angle) nameGuess = angle[1].trim();
        else if (comma && !comma[1].includes("@")) nameGuess = comma[1].trim();
        addSample(emails[0], nameGuess);
      }
    }

    for (const d of Object.values(byDomain)) {
      const votes = Object.entries(d.patternVotes).sort((a, b) => b[1] - a[1]);
      d.topPattern = votes[0]?.[0] || "first.last";
      d.topLabel = PATTERN_LIST.find((p) => p.id === d.topPattern)?.label || d.topPattern;
      d.confidence = votes[0] ? Math.min(0.98, votes[0][1] / Math.max(1, d.samples.length)) : 0.4;
      d.patternRanking = votes.map(([id, score]) => ({
        id,
        label: PATTERN_LIST.find((p) => p.id === id)?.label || id,
        score,
      }));
    }
    return byDomain;
  }

  function generateCandidates({ firstName, lastName, fullName, domain, preferredPatternId, learned, includeRoles = true }) {
    const parsed = fullName ? parsePersonName(fullName) : { first: slug(firstName), last: slug(lastName), middle: [] };
    const first = parsed.first;
    const last = parsed.last;
    const mid = (parsed.middle || [])[0] || "";
    const dom = normalizeDomain(domain);
    if (!first || !last || !dom) return [];

    const preferred = preferredPatternId || learned?.[dom]?.topPattern || "first.last";
    const learnedConf = learned?.[dom]?.confidence ? Math.round(learned[dom].confidence * 100) : null;

    const ordered = [
      ...PATTERN_LIST.filter((p) => p.id === preferred),
      ...PATTERN_LIST.filter((p) => p.id !== preferred),
    ];

    const out = [];
    const seen = new Set();
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const local = p.build(first, last, mid);
      if (!local) continue;
      const email = `${local}@${dom}`;
      if (seen.has(email)) continue;
      seen.add(email);
      const isPreferred = p.id === preferred;
      out.push({
        email,
        patternId: p.id,
        patternLabel: p.label,
        confidence: isPreferred ? learnedConf || 85 : Math.max(22, 72 - i * 4),
        rank: out.length + 1,
        preferred: isPreferred,
        method: "permutator",
      });
    }

    if (includeRoles) {
      ["rh", "recrutement", "recruitment", "talent", "careers", "jobs", "carrieres", "hr", "emploi", "commercial", "contact"].forEach(
        (local, idx) => {
          const email = `${local}@${dom}`;
          if (seen.has(email)) return;
          seen.add(email);
          out.push({
            email,
            patternId: "rolebox",
            patternLabel: `boîte ${local}`,
            confidence: Math.max(18, 46 - idx * 2),
            rank: 100 + idx,
            preferred: false,
            roleMailbox: true,
            method: "rolebox",
          });
        }
      );
    }
    return out;
  }

  /** Cloudflare DNS-over-HTTPS — check MX exists (domain accepts mail) */
  async function checkDomainMx(domain) {
    const d = normalizeDomain(domain);
    if (!d) return { ok: false, mx: [] };
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=MX`, {
        headers: { Accept: "application/dns-json" },
      });
      if (!res.ok) throw new Error(`DNS ${res.status}`);
      const data = await res.json();
      const mx = (data.Answer || [])
        .filter((a) => a.type === 15)
        .map((a) => a.data);
      return { ok: mx.length > 0, mx, domain: d };
    } catch (e) {
      return { ok: false, mx: [], error: e.message, domain: d };
    }
  }

  /**
   * Hunter.io free API (user key) — email-finder + domain-search pattern.
   * https://hunter.io/api-documentation/v2
   */
  async function hunterFind({ apiKey, domain, firstName, lastName, fullName }) {
    if (!apiKey) throw new Error("Clé Hunter manquante (Connecteurs)");
    const parsed = fullName ? parsePersonName(fullName) : { first: slug(firstName), last: slug(lastName) };
    const params = new URLSearchParams({
      domain: normalizeDomain(domain),
      first_name: parsed.firstRaw || parsed.first,
      last_name: parsed.lastRaw || parsed.last,
      api_key: apiKey,
    });
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.details || `Hunter HTTP ${res.status}`);
    const email = data?.data?.email;
    if (!email) return { found: false, data: data?.data || null };
    return {
      found: true,
      email,
      score: data.data.score,
      position: data.data.position,
      company: data.data.company,
      sources: data.data.sources || [],
      method: "hunter",
    };
  }

  async function hunterDomainPattern({ apiKey, domain }) {
    if (!apiKey) throw new Error("Clé Hunter manquante");
    const params = new URLSearchParams({
      domain: normalizeDomain(domain),
      api_key: apiKey,
      limit: "10",
    });
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.details || `Hunter HTTP ${res.status}`);
    const pattern = data?.data?.pattern; // e.g. {first}.{last}
    const emails = (data?.data?.emails || []).map((e) => ({
      email: e.value,
      name: [e.first_name, e.last_name].filter(Boolean).join(" "),
      confidence: e.confidence,
      position: e.position,
    }));
    let patternId = "first.last";
    if (pattern === "{f}{last}") patternId = "flast";
    else if (pattern === "{f}.{last}") patternId = "f.last";
    else if (pattern === "{first}{last}") patternId = "firstlast";
    else if (pattern === "{first}_{last}") patternId = "first_last";
    else if (pattern === "{first}-{last}") patternId = "first-last";
    else if (pattern === "{last}.{first}") patternId = "last.first";
    return { pattern, patternId, emails, organization: data?.data?.organization };
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
        sales: "Commercial",
        contact: "Contact",
      }[role] || role
    );
  }

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

Profil : ${profile.headline || "en évolution de carrière"}.

${(profile.summary || "").slice(0, 380)}

Seriez-vous ouvert(e) à un échange de 15 minutes ?

Bien cordialement,
${name}
${profile.email || ""}
${profile.linkedinUrl || ""}`,
      to: email,
    };
  }

  return {
    PATTERNS: PATTERN_LIST,
    FREE_TOOLS,
    parsePersonName,
    extractEmails,
    domainFromEmail,
    normalizeDomain,
    guessDomainFromCompany,
    guessDomainsFromCompany,
    inferPatternFromSample,
    learnFromPublicSamples,
    parseBusinessCard,
    generateCandidates,
    checkDomainMx,
    hunterFind,
    hunterDomainPattern,
    detectRole,
    roleLabel,
    buildDualOutreach,
  };
})();

window.EmailFinder = EmailFinder;
