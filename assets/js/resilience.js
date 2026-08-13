/**
 * Resilience — AscendOS keeps working when hosts / APIs / modules are down.
 * Timeouts, circuit breaker, soft fail. Never blocks the local product.
 */
const AscendResilience = (() => {
  const HEALTH_KEY = "ascendos.host.health.v1";
  const DEFAULT_TIMEOUT_MS = 9000;
  const COOLDOWN_MS = 15 * 60 * 1000; // skip known-down hosts for 15 min
  const FAIL_THRESHOLD = 2;

  function loadHealth() {
    try {
      return JSON.parse(localStorage.getItem(HEALTH_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveHealth(h) {
    try {
      localStorage.setItem(HEALTH_KEY, JSON.stringify(h));
    } catch {
      /* quota */
    }
  }

  function hostOf(url) {
    try {
      return new URL(url, location.href).host;
    } catch {
      return "unknown";
    }
  }

  function isHostCooling(host) {
    const h = loadHealth()[host];
    if (!h) return false;
    if (h.downUntil && Date.now() < h.downUntil) return true;
    return false;
  }

  function markSuccess(host) {
    const all = loadHealth();
    all[host] = { fails: 0, lastOk: Date.now(), downUntil: 0 };
    saveHealth(all);
  }

  function markFailure(host, reason = "") {
    const all = loadHealth();
    const prev = all[host] || { fails: 0 };
    const fails = (prev.fails || 0) + 1;
    all[host] = {
      fails,
      lastFail: Date.now(),
      reason: String(reason || "").slice(0, 120),
      downUntil: fails >= FAIL_THRESHOLD ? Date.now() + COOLDOWN_MS : prev.downUntil || 0,
    };
    saveHealth(all);
    return all[host];
  }

  function statusReport() {
    const all = loadHealth();
    return Object.entries(all).map(([host, v]) => ({
      host,
      cooling: Boolean(v.downUntil && Date.now() < v.downUntil),
      fails: v.fails || 0,
      reason: v.reason || "",
      lastOk: v.lastOk || null,
    }));
  }

  /**
   * fetch with timeout + circuit breaker.
   * @returns {Promise<Response>}
   */
  async function fetch(url, opts = {}) {
    const host = hostOf(url);
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (isHostCooling(host) && !opts.force) {
      const err = new Error(`Host ${host} en cooldown (down récent)`);
      err.code = "HOST_COOLING";
      err.host = host;
      throw err;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const userSignal = opts.signal;
    if (userSignal) {
      if (userSignal.aborted) ctrl.abort();
      else userSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
    }

    try {
      const { timeoutMs: _t, force: _f, ...rest } = opts;
      const res = await globalThis.fetch(url, { ...rest, signal: ctrl.signal });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        // 4xx (except 429) = host reachable
        markSuccess(host);
      } else if (res.status >= 500 || res.status === 429) {
        markFailure(host, `HTTP ${res.status}`);
      }
      return res;
    } catch (e) {
      const msg = e.name === "AbortError" ? "timeout" : e.message || "network";
      markFailure(host, msg);
      const err = new Error(`Réseau ${host}: ${msg}`);
      err.code = e.name === "AbortError" ? "TIMEOUT" : "NETWORK";
      err.host = host;
      err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJson(url, opts = {}) {
    const res = await AscendResilience.fetch(url, {
      ...opts,
      headers: { Accept: "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 429) {
      const err = new Error("Rate limit 429");
      err.code = 429;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.code = res.status;
      throw err;
    }
    return res.json();
  }

  /** Soft wrapper: never throws — returns { ok, data|error }. */
  async function tryJson(url, opts = {}) {
    try {
      const data = await fetchJson(url, opts);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message, code: e.code, host: e.host };
    }
  }

  function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "op") {
    return Promise.race([
      promise,
      new Promise((_, rej) => {
        const err = new Error(`${label} timeout ${ms}ms`);
        err.code = "TIMEOUT";
        setTimeout(() => rej(err), ms);
      }),
    ]);
  }

  /** Run tasks in sequence; collect results; never abort the whole batch on one fail. */
  async function settleAll(tasks) {
    const out = [];
    for (const t of tasks) {
      try {
        out.push({ ok: true, value: await t() });
      } catch (e) {
        out.push({ ok: false, error: e });
      }
    }
    return out;
  }

  return {
    fetch,
    fetchJson,
    tryJson,
    withTimeout,
    settleAll,
    isHostCooling,
    markSuccess,
    markFailure,
    statusReport,
    hostOf,
    COOLDOWN_MS,
    DEFAULT_TIMEOUT_MS,
  };
})();

window.AscendResilience = AscendResilience;
