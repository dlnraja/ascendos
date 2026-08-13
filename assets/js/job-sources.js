/**
 * JobSources — polite multi-source aggregator for FRESH jobs.
 *
 * Policy: ONLY official public APIs / RSS / user-provided feeds.
 * NO anti-bot bypass, NO proxy rotation to evade bans, NO LinkedIn/X scraping.
 * Rate limits + local cache + sequential backoff keep free tiers usable.
 */
const JobSources = (() => {
  const CACHE_KEY = "ascendos.jobSources.cache.v1";
  const RATE_KEY = "ascendos.jobSources.rate.v1";

  /**
   * Registry of sources. `minIntervalMs` = polite client-side throttle.
   * `freshnessNote` explains real-world lag (important for Remotive/Himalayas).
   */
  const SOURCES = [
    {
      id: "remotive",
      label: "Remotive",
      kind: "api",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "API publique souvent décalée ~24h (ToS). Créditer Remotive + lien original.",
      enabledDefault: true,
      docs: "https://remotive.com/remote-jobs/api",
    },
    {
      id: "remoteok",
      label: "Remote OK",
      kind: "api",
      free: true,
      minIntervalMs: 30 * 60 * 1000,
      freshnessNote: "JSON + RSS publics. Créditer Remote OK.",
      enabledDefault: true,
      docs: "https://remoteok.com/api",
    },
    {
      id: "arbeitnow",
      label: "Arbeitnow (EU)",
      kind: "api",
      free: true,
      minIntervalMs: 30 * 60 * 1000,
      freshnessNote: "Feed EU / remote. CORS OK. Filtrer remote si besoin.",
      enabledDefault: true,
      docs: "https://www.arbeitnow.com/api/job-board-api",
    },
    {
      id: "jobicy",
      label: "Jobicy",
      kind: "api",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "Max 1 req/heure recommandé. RSS aussi dispo.",
      enabledDefault: true,
      docs: "https://jobicy.com/jobs-rss-feed",
    },
    {
      id: "himalayas",
      label: "Himalayas",
      kind: "api",
      free: true,
      minIntervalMs: 24 * 60 * 60 * 1000,
      freshnessNote: "Cache upstream ~24h — inutile de poller plus souvent. 429 si excessif.",
      enabledDefault: true,
      docs: "https://himalayas.app/docs/remote-jobs-api",
    },
    {
      id: "wwr_rss",
      label: "We Work Remotely (RSS)",
      kind: "rss",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "RSS officiel catégories. Via parseur RSS (quota gratuit limité).",
      enabledDefault: true,
      docs: "https://weworkremotely.com/",
      rssUrls: [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
        "https://weworkremotely.com/categories/remote-product-jobs.rss",
        "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
      ],
    },
    {
      id: "remoteok_rss",
      label: "Remote OK (RSS)",
      kind: "rss",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "Complément RSS si l'API JSON est limitée.",
      enabledDefault: false,
      docs: "https://remoteok.com/remote-jobs.rss",
      rssUrls: ["https://remoteok.com/remote-jobs.rss"],
    },
    {
      id: "himalayas_rss",
      label: "Himalayas (RSS)",
      kind: "rss",
      free: true,
      minIntervalMs: 24 * 60 * 60 * 1000,
      freshnessNote: "100 jobs les plus récents, refresh ~24h.",
      enabledDefault: false,
      docs: "https://himalayas.app/jobs/rss",
      rssUrls: ["https://himalayas.app/jobs/rss"],
    },
    {
      id: "jobicy_rss",
      label: "Jobicy (RSS)",
      kind: "rss",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "Feed RSS Jobicy.",
      enabledDefault: false,
      docs: "https://jobicy.com/jobs/feed",
      rssUrls: ["https://jobicy.com/jobs/feed"],
    },
    {
      id: "hn_hiring",
      label: "HN Who's Hiring (Algolia)",
      kind: "api",
      free: true,
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "Threads mensuels — pas du <1h, mais signal utile.",
      enabledDefault: false,
      docs: "https://hn.algolia.com/api",
    },
    {
      id: "custom_rss",
      label: "Flux RSS perso (Twitter/X lists via ton bridge)",
      kind: "rss",
      free: true,
      minIntervalMs: 30 * 60 * 1000,
      freshnessNote:
        "Colle tes URLs RSS (RssHub auto-hébergé, listes X exportées, alertes boîte…). Pas de scrape X/LinkedIn depuis AscendOS.",
      enabledDefault: true,
      docs: "docs/JOB_SOURCES.md",
    },
    {
      id: "adzuna",
      label: "Adzuna (clé API)",
      kind: "api_key",
      free: "freemium",
      minIntervalMs: 60 * 60 * 1000,
      freshnessNote: "Free tier limité — mets APP_ID + APP_KEY dans Connecteurs.",
      enabledDefault: false,
      docs: "https://developer.adzuna.com/",
    },
  ];

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function loadRate() {
    try {
      return JSON.parse(localStorage.getItem(RATE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveRate(rate) {
    localStorage.setItem(RATE_KEY, JSON.stringify(rate));
  }

  function canFetch(sourceId, minIntervalMs) {
    const rate = loadRate();
    const last = rate[sourceId] || 0;
    return Date.now() - last >= minIntervalMs;
  }

  function markFetched(sourceId) {
    const rate = loadRate();
    rate[sourceId] = Date.now();
    saveRate(rate);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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
      employerType: partial.employerType || "unknown",
      postedAt: partial.postedAt || Date.now(),
      createdAt: Date.now(),
      status: "saved",
      attribution: partial.attribution || partial.source,
    };
  }

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Accept: "application/json",
        ...(opts.headers || {}),
      },
    });
    if (res.status === 429) {
      const err = new Error("Rate limit 429 — respecte le quota, réessaie plus tard");
      err.code = 429;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /** Remotive */
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

  /** RemoteOK — skip first legal element */
  async function pullRemoteOk(query, hours) {
    const data = await fetchJson("https://remoteok.com/api");
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
          postedAt: j.date ? Date.parse(j.date) : (j.epoch ? j.epoch * 1000 : Date.now()),
          attribution: "Remote OK",
        })
      )
      .filter((j) => {
        if (j.postedAt < cutoff) return false;
        if (!q) return true;
        const blob = `${j.title} ${j.company} ${(j.tags || []).join(" ")}`.toLowerCase();
        return blob.includes(q);
      });
  }

  /** Arbeitnow */
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
        return `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q);
      })
      .slice(0, 80);
  }

  /** Jobicy */
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

  /** Himalayas */
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
          location: j.locationRestrictions?.join(", ") || "Remote",
          url: j.applicationLink || j.url || `https://himalayas.app/jobs/${j.slug || j.id}`,
          description: j.description,
          tags: j.categories || [],
          postedAt: Date.parse(j.pubDate || j.createdAt || j.postedAt) || Date.now(),
          attribution: "Himalayas",
        })
      )
      .filter((j) => j.postedAt >= cutoff || hours >= 48);
  }

  /** HN Algolia hiring */
  async function pullHnHiring(query) {
    const q = query ? `${query} hiring` : "Ask HN: Who is hiring";
    const data = await fetchJson(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(q)}&hitsPerPage=20`
    );
    return (data.hits || [])
      .filter((h) => /hiring|freelancer|seeking/i.test(h.title || ""))
      .map((h) =>
        normJob({
          externalId: `hn_${h.objectID}`,
          source: "hn_hiring",
          title: h.title,
          company: "Hacker News",
          location: "Remote / various",
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          description: (h.story_text || "").slice(0, 1200),
          tags: ["hn", "hiring"],
          postedAt: (h.created_at_i || 0) * 1000 || Date.now(),
          attribution: "Hacker News",
        })
      );
  }

  /**
   * RSS via rss2json free public endpoint (rate-limited).
   * User should prefer self-hosted bridge for heavy use.
   */
  async function pullRssFeed(rssUrl, sourceId, hours) {
    const bridge = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const data = await fetchJson(bridge);
    if (data.status && data.status !== "ok") throw new Error(data.message || "RSS parse fail");
    const cutoff = Date.now() - hours * 3600 * 1000;
    return (data.items || [])
      .map((item, idx) =>
        normJob({
          externalId: `${sourceId}_${item.guid || item.link || idx}`,
          source: sourceId,
          title: item.title,
          company: data.feed?.title || sourceId,
          location: "Remote / see post",
          url: item.link,
          description: item.description || item.content,
          tags: item.categories || [],
          postedAt: Date.parse(item.pubDate) || Date.now(),
          attribution: data.feed?.title || sourceId,
        })
      )
      .filter((j) => j.postedAt >= cutoff || hours >= 72);
  }

  async function pullAdzuna(query, hours, keys) {
    if (!keys?.adzunaAppId || !keys?.adzunaAppKey) {
      throw new Error("Adzuna: renseigne APP_ID + APP_KEY");
    }
    const what = encodeURIComponent(query || "developer");
    const url = `https://api.adzuna.com/v1/api/jobs/fr/search/1?app_id=${keys.adzunaAppId}&app_key=${keys.adzunaAppKey}&results_per_page=30&what=${what}&max_days_old=${Math.max(1, Math.ceil(hours / 24))}`;
    const data = await fetchJson(url);
    return (data.results || []).map((j) =>
      normJob({
        externalId: `adzuna_${j.id}`,
        source: "adzuna",
        title: j.title,
        company: j.company?.display_name,
        location: j.location?.display_name,
        url: j.redirect_url,
        description: j.description,
        tags: [],
        postedAt: Date.parse(j.created) || Date.now(),
        attribution: "Adzuna",
      })
    );
  }

  function getCached(sourceId, maxAgeMs) {
    const cache = loadCache();
    const entry = cache[sourceId];
    if (!entry) return null;
    if (Date.now() - entry.at > maxAgeMs) return null;
    return entry.jobs;
  }

  function setCached(sourceId, jobs) {
    const cache = loadCache();
    cache[sourceId] = { at: Date.now(), jobs };
    saveCache(cache);
  }

  /**
   * Aggregate enabled sources politely (sequential + delay).
   */
  async function aggregate({
    query = "",
    hours = 24,
    enabledIds = null,
    customRss = [],
    apiKeys = {},
    force = false,
    onProgress = null,
  } = {}) {
    const enabled = new Set(
      enabledIds || SOURCES.filter((s) => s.enabledDefault).map((s) => s.id)
    );
    const report = [];
    const all = [];
    const delayBetween = 800;

    async function runOne(source, pullFn) {
      if (!enabled.has(source.id)) {
        report.push({ id: source.id, status: "skipped" });
        return;
      }
      onProgress?.({ id: source.id, status: "start", label: source.label });

      if (!force && !canFetch(source.id, source.minIntervalMs)) {
        const cached = getCached(source.id, source.minIntervalMs);
        if (cached) {
          all.push(...cached);
          report.push({
            id: source.id,
            status: "cached",
            count: cached.length,
            note: `Throttle ${Math.round(source.minIntervalMs / 60000)} min — cache servi`,
          });
          onProgress?.({ id: source.id, status: "cached", count: cached.length });
          return;
        }
        report.push({
          id: source.id,
          status: "throttled",
          note: `Attends encore (min ${Math.round(source.minIntervalMs / 60000)} min)`,
        });
        onProgress?.({ id: source.id, status: "throttled" });
        return;
      }

      try {
        const jobs = await pullFn();
        setCached(source.id, jobs);
        markFetched(source.id);
        all.push(...jobs);
        report.push({ id: source.id, status: "ok", count: jobs.length, note: source.freshnessNote });
        onProgress?.({ id: source.id, status: "ok", count: jobs.length });
      } catch (e) {
        const cached = getCached(source.id, 7 * 24 * 3600 * 1000);
        if (cached?.length) {
          all.push(...cached);
          report.push({
            id: source.id,
            status: "fallback_cache",
            count: cached.length,
            note: e.message,
          });
        } else {
          report.push({ id: source.id, status: "error", note: e.message });
        }
        onProgress?.({ id: source.id, status: "error", note: e.message });
      }
      await sleep(delayBetween);
    }

    const byId = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

    await runOne(byId.remotive, () => pullRemotive(query, hours));
    await runOne(byId.remoteok, () => pullRemoteOk(query, hours));
    await runOne(byId.arbeitnow, () => pullArbeitnow(query, hours));
    await runOne(byId.jobicy, () => pullJobicy(query, hours));
    await runOne(byId.himalayas, () => pullHimalayas(query, hours));
    await runOne(byId.hn_hiring, () => pullHnHiring(query));
    await runOne(byId.adzuna, () => pullAdzuna(query, hours, apiKeys));

    // RSS packs
    for (const sid of ["wwr_rss", "remoteok_rss", "himalayas_rss", "jobicy_rss"]) {
      const src = byId[sid];
      await runOne(src, async () => {
        const out = [];
        for (const rss of src.rssUrls || []) {
          try {
            out.push(...(await pullRssFeed(rss, sid, hours)));
            await sleep(500);
          } catch (e) {
            /* continue other feeds */
          }
        }
        return out;
      });
    }

    // Custom RSS (Twitter bridges, company career RSS, etc.)
    if (enabled.has("custom_rss") && customRss.length) {
      await runOne(byId.custom_rss, async () => {
        const out = [];
        for (const rss of customRss.slice(0, 8)) {
          try {
            out.push(...(await pullRssFeed(rss, "custom_rss", hours)));
            await sleep(600);
          } catch (e) {
            /* skip bad feed */
          }
        }
        return out;
      });
    }

    // Dedupe by externalId / url
    const seen = new Set();
    const deduped = [];
    for (const j of all) {
      const key = j.externalId || j.url || `${j.title}|${j.company}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(j);
    }

    deduped.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));

    return { jobs: deduped, report, fetchedAt: Date.now() };
  }

  return {
    SOURCES,
    aggregate,
    canFetch,
    getCached,
  };
})();

window.JobSources = JobSources;
