/**
 * Email Finder — 100% usable without API keys or npm deps.
 * Local: permutator, vCard / cartes FR / signatures, MX via DoH.
 * Optional (coffre): Hunter.io free tier, Under IA (clé + URL base).
 */
const EmailFinder = (() => {
  const PATTERNS = [
    { id: "first.last", label: "prenom.nom", build: (f, l) => `${f}.${l}`, rank: 1 },
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
    { id: "last_first", label: "nom_prenom", build: (f, l) => `${l}_${f}`, rank: 14 },
    { id: "last-first", label: "nom-prenom", build: (f, l) => `${l}-${f}`, rank: 15 },
    { id: "f-last", label: "p-nom", build: (f, l) => `${f[0]}-${l}`, rank: 16 },
    {
      id: "first.m.last",
      label: "prenom.m.nom",
      build: (f, l, m) => (m ? `${f}.${m[0]}.${l}` : null),
      rank: 17,
    },
    {
      id: "fm.last",
      label: "pm.nom",
      build: (f, l, m) => (m ? `${f[0]}${m[0]}.${l}` : null),
      rank: 18,
    },
    {
      id: "firstmiddle.last",
      label: "prenomm.nom",
      build: (f, l, m) => (m ? `${f}${m[0]}.${l}` : null),
      rank: 19,
    },
  ];

  const PATTERN_LIST = [...new Map(PATTERNS.map((p) => [p.id, p])).values()].sort(
    (a, b) => (a.rank || 99) - (b.rank || 99)
  );

  const ROLE_MAILBOXES = [
    "rh",
    "recrutement",
    "recruitment",
    "talent",
    "careers",
    "jobs",
    "carrieres",
    "hr",
    "emploi",
    "commercial",
    "contact",
    "accueil",
    "info",
    "hello",
    "team",
  ];

  const ROLE_HINTS = {
    hr: ["rh", "hr", "recrut", "talent", "people", "drh", "acquisition", "mobilité", "mobilite"],
    pm: ["chef de projet", "project manager", "delivery", "responsable projet", "program manager", "pmo"],
    hiring_manager: ["manager", "lead", "head of", "directeur", "responsable", "engineering manager"],
    recruiter: ["recruiter", "sourcer", "chasse", "staffing"],
    sales: ["commercial", "sales", "account", "business develop", "adv", "chargé d'affaires", "charge d'affaires"],
  };

  const FREE_TOOLS = [
    { id: "local", label: "Permutator local", free: "illimité · 0 clé", url: null },
    { id: "card", label: "Cartes / vCard / signatures FR", free: "local", url: null },
    { id: "mx", label: "MX DNS (DoH)", free: "sans clé", url: null },
    { id: "hunter", label: "Hunter.io (optionnel)", free: "clé coffre", url: "https://hunter.io/users/sign_up" },
    { id: "under_ia", label: "Under IA (optionnel)", free: "clé + URL base", url: null },
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
      .replace(/^(?:m\.|mme\.?|mr\.?|mrs\.?|ms\.?|dr\.?|me\.?|mlle\.?)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return { first: "", last: "", middle: [], raw: "" };

    const parts = cleaned.split(" ").filter(Boolean);
    if (parts.length === 1) {
      return { first: slug(parts[0]), last: slug(parts[0]), middle: [], raw: cleaned, firstRaw: parts[0], lastRaw: parts[0] };
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
    const re =
      /(?:(?:\+|00)\s*33|0)\s*[1-9](?:[\s.\u00a0/-]*\d{2}){4}|\+\d{1,3}[\s.\u00a0/-]?\d[\d\s.\u00a0/-]{7,16}\d/g;
    return [...new Set(String(text || "").match(re) || [])].map((p) => p.replace(/\s+/g, " ").trim());
  }

  function extractUrls(text) {
    const re = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
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
    return `${c}.fr`;
  }

  function guessDomainsFromCompany(company) {
    const c = slug(company);
    if (!c) return [];
    return [`${c}.fr`, `${c}.com`, `${c}.eu`, `groupe-${c}.fr`, `${c}.group`, `${c}.io`];
  }

  function vcardUnfold(raw) {
    return String(raw || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  }

  function vcardProps(block, name) {
    const re = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, "gim");
    const out = [];
    let m;
    while ((m = re.exec(block))) out.push(m[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").trim());
    return out;
  }

  function parseVCard(raw) {
    const text = vcardUnfold(raw);
    const out = emptyCard("vcard");
    const fn = vcardProps(text, "FN")[0];
    const n = vcardProps(text, "N")[0];
    if (fn) out.fullName = fn;
    else if (n) {
      const parts = n.split(";");
      out.fullName = [parts[1], parts[0]].filter(Boolean).join(" ").trim();
    }
    out.company = (vcardProps(text, "ORG")[0] || "").split(";")[0].trim();
    out.title = vcardProps(text, "TITLE")[0] || vcardProps(text, "ROLE")[0] || "";
    out.emails = vcardProps(text, "EMAIL").map((e) => e.toLowerCase());
    out.phones = vcardProps(text, "TEL");
    const urls = vcardProps(text, "URL");
    out.website = urls.find((u) => !/linkedin/i.test(u)) || urls[0] || "";
    out.linkedin = urls.find((u) => /linkedin/i.test(u)) || "";
    if (out.emails[0]) out.domain = domainFromEmail(out.emails[0]);
    else if (out.website) out.domain = normalizeDomain(out.website);
    return out;
  }

  function emptyCard(source = "card") {
    return {
      fullName: "",
      title: "",
      company: "",
      emails: [],
      phones: [],
      domain: "",
      website: "",
      linkedin: "",
      source,
    };
  }

  /**
   * Parse business card / FR commercial signature / vCard — local only.
   */
  function parseBusinessCard(raw) {
    const text = String(raw || "").trim();
    if (!text) return emptyCard();

    if (/BEGIN:VCARD/i.test(text)) return parseVCard(text);

    const out = emptyCard("signature");
    out.emails = extractEmails(text);
    out.phones = extractPhones(text);
    const urls = extractUrls(text);
    out.website = urls.find((u) => !/linkedin\.com/i.test(u)) || "";
    out.linkedin = urls.find((u) => /linkedin\.com/i.test(u)) || "";

    // Strip quoted reply / disclaimer noise
    const cleaned = text
      .replace(/^>.*$/gm, "")
      .replace(/_{3,}[\s\S]*$/m, "")
      .replace(/Ce message.*confidentiel[\s\S]*$/i, "")
      .replace(/This (?:e-?mail|message).*confidential[\s\S]*$/i, "");

    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s|*·•\-–—]+/, "").trim())
      .filter((l) => l && !/^envoye de mon |^sent from my |^get outlook/i.test(l));

    for (const line of lines) {
      const mCompany = line.match(
        /^(?:société|societe|company|entreprise|agence|cabinet|groupe)\s*[:：\-–]\s*(.+)$/i
      );
      const mTitle = line.match(
        /^(?:titre|fonction|poste|title|job|rôle|role)\s*[:：\-–]\s*(.+)$/i
      );
      const mName = line.match(/^(?:nom|name|contact|de)\s*[:：\-–]\s*(.+)$/i);
      const mMail = line.match(/^(?:e-?mail|mail|courriel)\s*[:：\-–]\s*(.+)$/i);
      const mTel = line.match(/^(?:tel|tél|telephone|téléphone|portable|mobile|fax)\s*[:：\-–]\s*(.+)$/i);
      const mWeb = line.match(/^(?:web|site|www)\s*[:：\-–]\s*(.+)$/i);
      if (mCompany) out.company = mCompany[1].trim();
      if (mTitle) out.title = mTitle[1].trim();
      if (mName) out.fullName = mName[1].replace(/^(?:m\.|mme\.?)\s+/i, "").trim();
      if (mMail) out.emails = [...new Set([...out.emails, ...extractEmails(mMail[1])])];
      if (mTel) out.phones = [...new Set([...out.phones, mTel[1].trim()])];
      if (mWeb) out.website = mWeb[1].trim();
    }

    // Signature heuristic: block after Cordialement / Bien à vous / --
    const sigSplit = cleaned.split(
      /(?:^|\n)(?:--+|cordialement|bien\s+(?:à|a)\s+vous|best\s+regards|kind\s+regards|sincèrement|salutations)\s*[,!]?\s*(?:\n|$)/i
    );
    const sigBlock = sigSplit.length > 1 ? sigSplit[sigSplit.length - 1] : cleaned;
    const sigLines = sigBlock
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!out.fullName) {
      const skip =
        /^(tel|tél|portable|mobile|fax|email|mail|www|http|société|company|@|siret|rcs|tva|naf)/i;
      const candidate = [...sigLines, ...lines].find(
        (l) => !skip.test(l) && !l.includes("@") && l.length < 60 && /[a-zA-ZÀ-ÿ]{2}/.test(l) && !/\d{5}/.test(l)
      );
      if (candidate) out.fullName = candidate.replace(/^(m\.|mme\.?|mr\.?|mrs\.?|dr\.?)\s+/i, "").trim();
    }

    if (!out.title) {
      const titleLine = sigLines.find((l) =>
        /directeur|manager|commercial|responsable|consultant|ingénieur|ingenieur|chef|talent|rh\b|recrut/i.test(l)
      );
      if (titleLine && titleLine !== out.fullName) out.title = titleLine;
    }

    if (!out.company) {
      const co = [...sigLines, ...lines].find(
        (l) =>
          /(?:\bSAS\b|\bSARL\b|\bSA\b|\bSASU\b|\bSCI\b|inc\.|ltd|gmbh|groupe|company|associés|associes)/i.test(l) &&
          !l.includes("@") &&
          l !== out.fullName
      );
      if (co) out.company = co;
    }

    if (out.emails[0]) out.domain = domainFromEmail(out.emails[0]);
    else if (out.website) out.domain = normalizeDomain(out.website);

    out.source = /@/.test(text) && /cordialement|regards|--/i.test(text) ? "signature" : "card";
    return out;
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

  function learnFromPublicSamples(paste) {
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

  function generateCandidates({
    firstName,
    lastName,
    fullName,
    domain,
    preferredPatternId,
    learned,
    includeRoles = true,
  }) {
    const parsed = fullName
      ? parsePersonName(fullName)
      : { first: slug(firstName), last: slug(lastName), middle: [] };
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
      ROLE_MAILBOXES.forEach((local, idx) => {
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
      });
    }
    return out;
  }

  /** Full catalog of pattern templates (for export / pedagogy). */
  function listAllPatterns() {
    return PATTERN_LIST.map((p) => ({
      id: p.id,
      label: p.label,
      example: p.build("marie", "dupont", "a") || p.build("marie", "dupont"),
    }));
  }

  function exportCandidatesCsv(candidates = []) {
    const header = "rank,email,pattern,confidence,method,preferred,role_mailbox";
    const rows = candidates.map(
      (c) =>
        `${c.rank || ""},${c.email},${c.patternLabel || c.patternId || ""},${c.confidence ?? ""},${c.method || ""},${c.preferred ? 1 : 0},${c.roleMailbox ? 1 : 0}`
    );
    return [header, ...rows].join("\n");
  }

  function exportCandidatesJson(candidates = [], meta = {}) {
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "AscendOS EmailFinder · local permutator",
        note: "Guesses ≠ verified SMTP. Optional APIs not required.",
        ...meta,
        patternsCatalog: listAllPatterns(),
        candidates,
      },
      null,
      2
    );
  }

  function downloadText(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function dohMx(url) {
    const fetchFn = typeof AscendResilience !== "undefined" ? AscendResilience.fetch : fetch;
    const res = await fetchFn(url, { headers: { Accept: "application/dns-json" }, timeoutMs: 6000 });
    if (!res.ok) throw new Error(`DNS ${res.status}`);
    const data = await res.json();
    return (data.Answer || [])
      .filter((a) => a.type === 15)
      .map((a) => a.data);
  }

  /** MX via DNS-over-HTTPS — Cloudflare then Google. Soft-fail if both down. */
  async function checkDomainMx(domain) {
    const d = normalizeDomain(domain);
    if (!d) return { ok: false, mx: [], domain: d, degraded: true };
    const endpoints = [
      { provider: "cloudflare", url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=MX` },
      { provider: "google", url: `https://dns.google/resolve?name=${encodeURIComponent(d)}&type=MX` },
    ];
    const errors = [];
    try {
      if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("doh_mx");
    } catch {
      /* quota — still try once */
    }
    for (const ep of endpoints) {
      try {
        const mx = await dohMx(ep.url);
        return { ok: mx.length > 0, mx, domain: d, provider: ep.provider };
      } catch (e) {
        errors.push(`${ep.provider}: ${e.message}`);
      }
    }
    return {
      ok: false,
      mx: [],
      domain: d,
      degraded: true,
      error: `DNS down — ${errors.join(" · ")}. Domaine non vérifié, permutator local OK.`,
    };
  }

  async function hunterFind({ apiKey, domain, firstName, lastName, fullName }) {
    if (!apiKey) return { found: false, skipped: true, reason: "no_key" };
    if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("hunter_search");
    const parsed = fullName ? parsePersonName(fullName) : { first: slug(firstName), last: slug(lastName) };
    const params = new URLSearchParams({
      domain: normalizeDomain(domain),
      first_name: parsed.firstRaw || parsed.first,
      last_name: parsed.lastRaw || parsed.last,
      api_key: apiKey,
    });
    const res = await (typeof AscendResilience !== "undefined"
      ? AscendResilience.fetch(`https://api.hunter.io/v2/email-finder?${params}`, { timeoutMs: 8000 })
      : fetch(`https://api.hunter.io/v2/email-finder?${params}`));
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return { found: false, skipped: true, reason: "quota" };
    if (!res.ok) return { found: false, skipped: true, reason: `HTTP ${res.status}` };
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
    if (!apiKey) return { skipped: true, patternId: null, emails: [] };
    if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("hunter_domain");
    const params = new URLSearchParams({
      domain: normalizeDomain(domain),
      api_key: apiKey,
      limit: "5",
    });
    const res = await (typeof AscendResilience !== "undefined"
      ? AscendResilience.fetch(`https://api.hunter.io/v2/domain-search?${params}`, { timeoutMs: 8000 })
      : fetch(`https://api.hunter.io/v2/domain-search?${params}`));
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return { skipped: true, patternId: null, emails: [] };
    if (!res.ok) return { skipped: true, patternId: null, emails: [] };
    const pattern = data?.data?.pattern;
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

  /**
   * Under IA — optional. Missing config → skipped (caller uses local permutator).
   */
  async function underIaFind({ apiKey, apiBase, domain, fullName, firstName, lastName }) {
    if (!apiKey || !apiBase) return { found: false, skipped: true, reason: "no_key" };
    if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("under_ia");
    const parsed = fullName ? parsePersonName(fullName) : { first: slug(firstName), last: slug(lastName) };
    const base = String(apiBase).replace(/\/$/, "");
    const params = new URLSearchParams({
      domain: normalizeDomain(domain),
      first_name: parsed.firstRaw || parsed.first,
      last_name: parsed.lastRaw || parsed.last,
      api_key: apiKey,
      key: apiKey,
    });
    const res = await (typeof AscendResilience !== "undefined"
      ? AscendResilience.fetch(`${base}?${params}`, { timeoutMs: 8000 })
      : fetch(`${base}?${params}`));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { found: false, skipped: true, reason: data?.error || `HTTP ${res.status}` };
    const email = data.email || data?.data?.email || data?.result?.email;
    if (!email) return { found: false, data };
    return {
      found: true,
      email: String(email).toLowerCase(),
      score: data.score || data.confidence || null,
      method: "under_ia",
      raw: data,
    };
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
    parseVCard,
    generateCandidates,
    listAllPatterns,
    exportCandidatesCsv,
    exportCandidatesJson,
    downloadText,
    checkDomainMx,
    hunterFind,
    hunterDomainPattern,
    underIaFind,
    detectRole,
    roleLabel,
    buildDualOutreach,
  };
})();

window.EmailFinder = EmailFinder;
