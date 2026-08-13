/**
 * Fresh Radar — prioritize newest postings so you apply first.
 * Tiers: <1h (prime), <6h, <24h, <72h, stale.
 * Combines with career upgrade score → "apply-now" urgency.
 */
const FreshRadar = (() => {
  const TIERS = [
    { id: "prime", maxAgeMs: 60 * 60 * 1000, label: "< 1 h", short: "PRIME", tone: "ok", weight: 100 },
    { id: "hot", maxAgeMs: 6 * 60 * 60 * 1000, label: "< 6 h", short: "HOT", tone: "lime", weight: 82 },
    { id: "fresh", maxAgeMs: 24 * 60 * 60 * 1000, label: "< 24 h", short: "24h", tone: "info", weight: 68 },
    { id: "warm", maxAgeMs: 72 * 60 * 60 * 1000, label: "< 72 h", short: "72h", tone: "warn", weight: 45 },
    { id: "stale", maxAgeMs: Infinity, label: "Plus ancien", short: "STALE", tone: "bad", weight: 15 },
  ];

  function ageMs(job, now = Date.now()) {
    const posted = Number(job.postedAt || job.publicationDate || job.createdAt || 0);
    if (!posted) return null;
    return Math.max(0, now - posted);
  }

  function formatAge(ms) {
    if (ms == null) return "âge inconnu";
    const m = Math.floor(ms / 60000);
    if (m < 1) return "< 1 min";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h} h`;
    const d = Math.floor(h / 24);
    return `${d} j`;
  }

  function tierForAge(ms) {
    if (ms == null) return { ...TIERS[TIERS.length - 1], id: "unknown", label: "Inconnu", short: "?", weight: 30 };
    return TIERS.find((t) => ms <= t.maxAgeMs) || TIERS[TIERS.length - 1];
  }

  function freshnessScore(job, now = Date.now()) {
    const ms = ageMs(job, now);
    const tier = tierForAge(ms);
    // Continuous decay inside tier for finer ranking
    let score = tier.weight;
    if (ms != null && tier.maxAgeMs !== Infinity) {
      const ratio = ms / tier.maxAgeMs;
      score = Math.round(tier.weight - ratio * 12);
    }
    return {
      ageMs: ms,
      ageLabel: formatAge(ms),
      tier,
      score: Math.max(0, Math.min(100, score)),
    };
  }

  /**
   * Prime apply score: blend career upgrade + freshness.
   * Ultra-fresh high-leverage jobs win.
   */
  function primeApplyScore(job, profile, now = Date.now()) {
    const fresh = freshnessScore(job, now);
    const career =
      typeof CareerAccelerator !== "undefined"
        ? CareerAccelerator.scoreJob(job, profile)
        : { score: 50 };

    const freshWeight = fresh.tier.id === "prime" ? 0.55 : fresh.tier.id === "hot" ? 0.45 : fresh.tier.id === "fresh" ? 0.35 : 0.2;
    const careerWeight = 1 - freshWeight;
    const combined = Math.round(fresh.score * freshWeight + career.score * careerWeight);

    let urgency = "normal";
    if (fresh.tier.id === "prime" && career.score >= 55) urgency = "apply_now";
    else if (fresh.tier.id === "prime" || (fresh.tier.id === "hot" && career.score >= 65)) urgency = "high";
    else if (fresh.tier.id === "fresh" && career.score >= 60) urgency = "soon";

    return {
      combined,
      fresh,
      career,
      urgency,
      reason:
        urgency === "apply_now"
          ? "Offre ultra-fraîche (<1h) + bon levier carrière — postule en premier."
          : urgency === "high"
            ? "Fenêtre chaude : encore peu de candidats probables."
            : urgency === "soon"
              ? "Dans les 24h avec bon score upgrade — prioriser."
              : "Fraîcheur ou levier moyens — traiter après les PRIME.",
    };
  }

  function rankForFirstApply(jobs, profile, opts = {}) {
    const now = opts.now || Date.now();
    const maxAge = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;
    const minCareer = opts.minCareer ?? 0;

    return [...jobs]
      .map((j) => {
        const prime = primeApplyScore(j, profile, now);
        return { ...j, prime, accelerator: prime.career };
      })
      .filter((j) => {
        if (j.prime.fresh.ageMs != null && j.prime.fresh.ageMs > maxAge) return false;
        if (j.prime.career.score < minCareer) return false;
        return true;
      })
      .sort((a, b) => {
        const u = { apply_now: 3, high: 2, soon: 1, normal: 0 };
        const ud = (u[b.prime.urgency] || 0) - (u[a.prime.urgency] || 0);
        if (ud) return ud;
        return b.prime.combined - a.prime.combined;
      });
  }

  function postedAtFromPreset(preset) {
    const now = Date.now();
    const map = {
      just_now: now - 5 * 60 * 1000,
      under_1h: now - 45 * 60 * 1000,
      under_6h: now - 3 * 60 * 60 * 1000,
      under_24h: now - 12 * 60 * 60 * 1000,
      under_72h: now - 48 * 60 * 60 * 1000,
      older: now - 10 * 24 * 60 * 60 * 1000,
      unknown: null,
    };
    return map[preset] ?? null;
  }

  function parsePostedFromText(text) {
    const t = String(text || "").toLowerCase();
    const now = Date.now();
    if (/il y a\s*(\d+)\s*min|posted\s*(\d+)\s*m\b|(\d+)\s*minutes?\s*ago/.test(t)) {
      const n = Number(t.match(/(\d+)\s*min/)?.[1] || t.match(/(\d+)\s*m\b/)?.[1] || 30);
      return now - n * 60 * 1000;
    }
    if (/il y a\s*(\d+)\s*h|posted\s*(\d+)\s*h\b|(\d+)\s*hours?\s*ago/.test(t)) {
      const n = Number(t.match(/(\d+)\s*h/)?.[1] || 2);
      return now - n * 60 * 60 * 1000;
    }
    if (/aujourd'?hui|today|juste publi|just posted|new\b/.test(t)) return now - 2 * 60 * 60 * 1000;
    if (/hier|yesterday/.test(t)) return now - 26 * 60 * 60 * 1000;
    const iso = t.match(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i);
    if (iso) {
      const d = Date.parse(iso[0]);
      if (!Number.isNaN(d)) return d;
    }
    return null;
  }

  /**
   * Fresh fetch — always via AscendCore / LocalStack (backend → browser → cache).
   * @deprecated prefer AscendCore.jobs.aggregate
   */
  async function fetchRemotiveFresh(query = "", { hours = 24 } = {}) {
    const core = typeof AscendCore !== "undefined" ? AscendCore : typeof LocalStack !== "undefined" ? LocalStack : null;
    if (core?.jobs?.aggregate || core?.aggregateJobs) {
      const agg = core.jobs?.aggregate || core.aggregateJobs;
      const { jobs } = await agg({
        query,
        hours,
        enabledIds: ["remotive"],
        force: true,
        connectors: {},
      });
      return jobs || [];
    }
    if (typeof JobSources !== "undefined") {
      const { jobs } = await JobSources.aggregate({
        query,
        hours,
        enabledIds: ["remotive"],
        force: true,
      });
      return jobs;
    }
    return [];
  }

  async function fetchAllFresh(opts = {}) {
    const core = typeof AscendCore !== "undefined" ? AscendCore : typeof LocalStack !== "undefined" ? LocalStack : null;
    if (core?.jobs?.aggregate || core?.aggregateJobs) {
      const agg = core.jobs?.aggregate || core.aggregateJobs;
      return agg({
        query: opts.query || "",
        hours: opts.hours || 24,
        enabledIds: opts.enabledIds || null,
        customRss: opts.customRss || [],
        connectors:
          opts.connectors ||
          (opts.apiKeys
            ? {
                adzunaAppId: opts.apiKeys.adzunaAppId,
                adzunaAppKey: opts.apiKeys.adzunaAppKey,
                aggregateApiBase: "",
              }
            : {}),
        force: opts.force,
        onProgress: opts.onProgress,
      });
    }
    if (typeof JobSources === "undefined") return { jobs: await fetchRemotiveFresh(opts.query, opts), report: [] };
    return JobSources.aggregate(opts);
  }

  return {
    TIERS,
    ageMs,
    formatAge,
    freshnessScore,
    primeApplyScore,
    rankForFirstApply,
    postedAtFromPreset,
    parsePostedFromText,
    fetchRemotiveFresh,
    fetchAllFresh,
  };
})();

window.FreshRadar = FreshRadar;
