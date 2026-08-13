/**
 * Free-tier & GDPR guardian — hard caps so AscendOS never burns paid quotas
 * and the project author never receives / stores end-user personal data.
 *
 * Counters live ONLY in the user's browser (localStorage).
 */
const AscendQuotas = (() => {
  const KEY = "ascendos.quotas.v1";

  /**
   * Conservative ceilings under published free / freemium ranges.
   * Prefer failing closed (block) over exceeding a free tier.
   */
  const LIMITS = {
    hunter_search: { period: "month", max: 45, label: "API email (recherches / mois)" },
    hunter_domain: { period: "month", max: 20, label: "API email (domain-search / mois)" },
    under_ia: { period: "month", max: 40, label: "Under IA (req / mois)" },
    adzuna: { period: "day", max: 40, label: "Adzuna (req / jour)" },
    rss2json: { period: "day", max: 20, label: "Parseur RSS public (req / jour)" },
    doh_mx: { period: "hour", max: 30, label: "DNS MX (req / heure)" },
    aggregate_run: { period: "hour", max: 4, label: "Agrégation offres (runs / heure)" },
    google_userinfo: { period: "day", max: 20, label: "Google userinfo (req / jour)" },
    gmail_send: { period: "day", max: 40, label: "Gmail envoi (req / jour)" },
    enrich_public: { period: "hour", max: 12, label: "Enrichissement public (req / heure)" },
  };

  /** Keys that must NEVER be sent to an optional aggregate backend. */
  const FORBIDDEN_AGGREGATE_KEYS = [
    "profile",
    "cv",
    "resume",
    "email",
    "phone",
    "contacts",
    "fullName",
    "linkedin",
    "token",
    "access_token",
    "hunter",
    "apiKey",
    "api_key",
    "password",
    "passphrase",
  ];

  function periodKey(period) {
    const d = new Date();
    if (period === "hour") {
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-h${d.getUTCHours()}`;
    }
    if (period === "day") {
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }
    // month
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function usage(id) {
    const lim = LIMITS[id];
    if (!lim) return { used: 0, max: 0, remaining: 0 };
    const bucket = load()[id] || {};
    const pk = periodKey(lim.period);
    const used = Number(bucket[pk] || 0);
    return {
      used,
      max: lim.max,
      remaining: Math.max(0, lim.max - used),
      period: lim.period,
      label: lim.label,
    };
  }

  function can(id, n = 1) {
    const u = usage(id);
    if (!LIMITS[id]) return { ok: true, ...u };
    return { ok: u.used + n <= u.max, ...u };
  }

  function consume(id, n = 1) {
    const lim = LIMITS[id];
    if (!lim) return { ok: true };
    const check = can(id, n);
    if (!check.ok) {
      const err = new Error(
        `Quota gratuit atteint · ${lim.label} (${check.used}/${check.max} / ${lim.period}). Réessaie plus tard.`
      );
      err.code = "QUOTA";
      throw err;
    }
    const data = load();
    const pk = periodKey(lim.period);
    data[id] = data[id] || {};
    // drop old period keys for this id
    data[id] = { [pk]: Number(data[id][pk] || 0) + n };
    save(data);
    return { ok: true, ...usage(id) };
  }

  function statusList() {
    return Object.keys(LIMITS).map((id) => ({ id, ...usage(id) }));
  }

  /** Strip anything that looks like PII before optional backend calls. */
  function sanitizeAggregatePayload(raw = {}) {
    const clean = {
      query: String(raw.query || "").slice(0, 120),
      hours: Math.min(168, Math.max(1, Number(raw.hours) || 24)),
      sources: Array.isArray(raw.sources) ? raw.sources.map(String).slice(0, 20) : [],
      rss: Array.isArray(raw.rss)
        ? raw.rss.filter((u) => /^https?:\/\//i.test(u)).slice(0, 5)
        : [],
    };
    for (const k of Object.keys(raw || {})) {
      const low = k.toLowerCase();
      if (FORBIDDEN_AGGREGATE_KEYS.some((f) => low.includes(f))) {
        const err = new Error("RGPD · payload refusé (données perso / secrets interdits vers l’agrégateur)");
        err.code = "PII_BLOCK";
        throw err;
      }
    }
    return clean;
  }

  return {
    LIMITS,
    FORBIDDEN_AGGREGATE_KEYS,
    usage,
    can,
    consume,
    statusList,
    sanitizeAggregatePayload,
  };
})();

window.AscendQuotas = AscendQuotas;
