/**
 * Shared polite aggregator core (Cloudflare Worker + Vercel + Node/Oracle).
 * Official APIs/RSS only. No anti-bot bypass.
 * GDPR: never accept / log / store end-user profile data — job query only.
 */

const SOURCES_META = [
  { id: "remotive", minIntervalMs: 3600000 },
  { id: "remoteok", minIntervalMs: 1800000 },
  { id: "arbeitnow", minIntervalMs: 1800000 },
  { id: "jobicy", minIntervalMs: 3600000 },
  { id: "himalayas", minIntervalMs: 86400000 },
];

const PII_KEYS = [
  "profile",
  "cv",
  "resume",
  "email",
  "phone",
  "contacts",
  "fullname",
  "linkedin",
  "token",
  "access_token",
  "api_key",
  "apikey",
  "password",
  "passphrase",
  "hunter",
];

/** In-memory soft rate limit (per isolate) — stay in free Worker ranges. */
const rateBuckets = new Map();
const RATE_MAX_PER_HOUR = 30;

function clientKey(requestLike) {
  try {
    const h = requestLike?.headers;
    if (h && typeof h.get === "function") {
      return h.get("CF-Connecting-IP") || h.get("x-forwarded-for") || "anon";
    }
  } catch {
    /* ignore */
  }
  return "anon";
}

function checkRateLimit(ip) {
  const hour = Math.floor(Date.now() / 3600000);
  const key = `${ip}:${hour}`;
  const n = rateBuckets.get(key) || 0;
  if (n >= RATE_MAX_PER_HOUR) {
    const e = new Error("rate_limited_free_tier");
    e.code = 429;
    throw e;
  }
  rateBuckets.set(key, n + 1);
  // prune old
  if (rateBuckets.size > 5000) {
    for (const k of rateBuckets.keys()) {
      if (!k.endsWith(`:${hour}`)) rateBuckets.delete(k);
    }
  }
}

function assertNoPii(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    const low = k.toLowerCase();
    if (PII_KEYS.some((f) => low.includes(f))) {
      const e = new Error("pii_forbidden");
      e.code = 400;
      throw e;
    }
  }
}

function sanitizeOpts(opts = {}) {
  assertNoPii(opts);
  return {
    query: String(opts.query || "").slice(0, 120),
    hours: Math.min(168, Math.max(1, Number(opts.hours) || 24)),
    sources: Array.isArray(opts.sources) ? opts.sources.map(String).slice(0, 20) : [],
    rss: Array.isArray(opts.rss)
      ? opts.rss.filter((u) => /^https?:\/\//i.test(String(u))).map(String).slice(0, 5)
      : [],
  };
}
function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function normJob(partial) {
  return {
    externalId: partial.externalId,
    source: partial.source,
    title: partial.title || "Sans titre",
    company: partial.company || "—",
    location: partial.location || "",
    url: partial.url || "",
    description: stripHtml(partial.description || ""),
    tags: partial.tags || [],
    employerType: "unknown",
    postedAt: partial.postedAt || Date.now(),
    createdAt: Date.now(),
    status: "saved",
    attribution: partial.attribution || partial.source,
  };
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) },
  });
  if (res.status === 429) {
    const e = new Error("429 rate limit");
    e.code = 429;
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function pullRemotive(query, hours) {
  const url = query
    ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`
    : `https://remotive.com/api/remote-jobs?limit=50`;
  const data = await fetchJson(url);
  const cutoff = Date.now() - hours * 3600 * 1000;
  return (data.jobs || [])
    .map((j) =>
      normJob({
        externalId: `remotive_${j.id}`,
        source: "remotive",
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        url: j.url,
        description: j.description,
        tags: j.tags || [],
        postedAt: Date.parse(j.publication_date) || Date.now(),
        attribution: "Remotive",
      })
    )
    .filter((j) => j.postedAt >= cutoff || hours >= 48);
}

async function pullRemoteOk(query, hours) {
  const data = await fetchJson("https://remoteok.com/api", {
    headers: { "User-Agent": "AscendOS/1.0 (job aggregator; +https://github.com/dlnraja/ascendos)" },
  });
  const cutoff = Date.now() - hours * 3600 * 1000;
  const q = String(query || "").toLowerCase();
  return (Array.isArray(data) ? data : [])
    .filter((j) => j && j.id && j.position)
    .map((j) =>
      normJob({
        externalId: `remoteok_${j.id}`,
        source: "remoteok",
        title: j.position,
        company: j.company,
        location: j.location || "Remote",
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        description: j.description,
        tags: j.tags || [],
        postedAt: j.date ? Date.parse(j.date) : j.epoch ? j.epoch * 1000 : Date.now(),
        attribution: "Remote OK",
      })
    )
    .filter((j) => {
      if (j.postedAt < cutoff) return false;
      if (!q) return true;
      return `${j.title} ${j.company} ${(j.tags || []).join(" ")}`.toLowerCase().includes(q);
    });
}

async function pullArbeitnow(query, hours) {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  const cutoff = Date.now() - hours * 3600 * 1000;
  const q = String(query || "").toLowerCase();
  return (data.data || [])
    .map((j) =>
      normJob({
        externalId: `arbeitnow_${j.slug || j.url}`,
        source: "arbeitnow",
        title: j.title,
        company: j.company_name,
        location: j.location || (j.remote ? "Remote" : ""),
        url: j.url,
        description: j.description,
        tags: j.tags || [],
        postedAt: j.created_at ? Date.parse(j.created_at) : Date.now(),
        attribution: "Arbeitnow",
      })
    )
    .filter((j) => {
      if (j.postedAt && j.postedAt < cutoff) return false;
      if (!q) return true;
      return `${j.title} ${j.company}`.toLowerCase().includes(q);
    })
    .slice(0, 80);
}

async function pullJobicy(query, hours) {
  const params = new URLSearchParams({ count: "50" });
  if (query) params.set("tag", query);
  const data = await fetchJson(`https://jobicy.com/api/v2/remote-jobs?${params}`);
  const cutoff = Date.now() - hours * 3600 * 1000;
  return (data.jobs || [])
    .map((j) =>
      normJob({
        externalId: `jobicy_${j.id}`,
        source: "jobicy",
        title: j.jobTitle,
        company: j.companyName,
        location: j.jobGeo || "Remote",
        url: j.url,
        description: j.jobDescription,
        tags: [].concat(j.jobIndustry || [], j.jobType || []),
        postedAt: Date.parse(j.pubDate) || Date.now(),
        attribution: "Jobicy",
      })
    )
    .filter((j) => j.postedAt >= cutoff || hours >= 72);
}

async function pullHimalayas(query, hours) {
  const url = query
    ? `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(query)}&limit=20`
    : `https://himalayas.app/jobs/api?limit=20&offset=0`;
  const data = await fetchJson(url);
  const cutoff = Date.now() - hours * 3600 * 1000;
  const list = data.jobs || data.data || [];
  return list
    .map((j) =>
      normJob({
        externalId: `himalayas_${j.id || j.slug}`,
        source: "himalayas",
        title: j.title,
        company: j.companyName || j.company?.name,
        location: (j.locationRestrictions || []).join(", ") || "Remote",
        url: j.applicationLink || j.url || `https://himalayas.app/jobs/${j.slug || j.id}`,
        description: j.description,
        tags: j.categories || [],
        postedAt: Date.parse(j.pubDate || j.createdAt || j.postedAt) || Date.now(),
        attribution: "Himalayas",
      })
    )
    .filter((j) => j.postedAt >= cutoff || hours >= 48);
}

async function pullRss(rssUrl, sourceId, hours) {
  const res = await fetch(rssUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const cutoff = Date.now() - hours * 3600 * 1000;
  for (const block of blocks.slice(0, 40)) {
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
      block.match(/<title>(.*?)<\/title>/i) || [])[1];
    const link = (block.match(/<link>(.*?)<\/link>/i) || [])[1];
    const desc =
      (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/is) ||
        block.match(/<description>(.*?)<\/description>/is) || [])[1];
    const pub = (block.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1];
    const postedAt = pub ? Date.parse(pub) : Date.now();
    if (postedAt < cutoff && hours < 72) continue;
    items.push(
      normJob({
        externalId: `${sourceId}_${link || title}`,
        source: sourceId,
        title: title?.replace(/<[^>]+>/g, "").trim(),
        company: sourceId,
        url: link?.trim(),
        description: desc,
        postedAt,
        attribution: sourceId,
      })
    );
  }
  return items;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {object} opts
 * @param {string} [opts.query]
 * @param {number} [opts.hours]
 * @param {string[]} [opts.sources]
 * @param {string[]} [opts.rss]
 */
async function aggregateServer(opts = {}, requestLike = null) {
  if (requestLike) checkRateLimit(clientKey(requestLike));
  const clean = sanitizeOpts(opts);
  const query = clean.query;
  const hours = clean.hours;
  const want = new Set(
    clean.sources.length
      ? clean.sources
      : ["remotive", "remoteok", "arbeitnow", "jobicy", "himalayas"]
  );
  const report = [];
  const all = [];

  async function run(id, fn) {
    if (!want.has(id) && id !== "custom_rss") return;
    try {
      const jobs = await fn();
      all.push(...jobs);
      report.push({ id, status: "ok", count: jobs.length });
    } catch (e) {
      report.push({ id, status: "error", note: String(e.message || e).slice(0, 120) });
    }
    await sleep(400);
  }

  await run("remotive", () => pullRemotive(query, hours));
  await run("remoteok", () => pullRemoteOk(query, hours));
  await run("arbeitnow", () => pullArbeitnow(query, hours));
  await run("jobicy", () => pullJobicy(query, hours));
  await run("himalayas", () => pullHimalayas(query, hours));

  const defaultRss = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://remoteok.com/remote-jobs.rss",
  ];
  if (want.has("wwr_rss") || want.has("remoteok_rss")) {
    for (const rss of defaultRss) {
      const id = rss.includes("weworkremotely") ? "wwr_rss" : "remoteok_rss";
      if (!want.has(id)) continue;
      await run(id, () => pullRss(rss, id, hours));
    }
  }

  for (const rss of clean.rss) {
    try {
      const jobs = await pullRss(rss, "custom_rss", hours);
      all.push(...jobs);
      report.push({ id: "custom_rss", status: "ok", count: jobs.length });
    } catch (e) {
      report.push({ id: "custom_rss", status: "error", note: String(e.message || e).slice(0, 120) });
    }
    await sleep(400);
  }

  const seen = new Set();
  const jobs = [];
  for (const j of all) {
    const key = j.externalId || j.url;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(j);
  }
  jobs.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));

  return {
    ok: true,
    jobs,
    report,
    fetchedAt: new Date().toISOString(),
    provider: "ascendos-aggregate",
    privacy: "no_user_data_stored",
    meta: { sources: SOURCES_META, rateMaxPerHour: RATE_MAX_PER_HOUR },
  };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120",
  };
}

export { aggregateServer, corsHeaders, SOURCES_META, sanitizeOpts, assertNoPii };
