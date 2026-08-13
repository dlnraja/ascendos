/**
 * WeeklyPlan — local habit layer (streak + weekly targets). No cloud.
 */
const WeeklyPlan = (() => {
  const KEY = "ascendos.activity.v1";

  const DEFAULTS = {
    targets: {
      apply: 8,
      outreach: 5,
      prep: 3,
      boost: 2,
    },
  };

  function weekId(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
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

  function log(type, meta = {}) {
    const data = load();
    const wid = weekId();
    data.events = data.events || [];
    data.events.unshift({ type, at: Date.now(), week: wid, ...meta });
    data.events = data.events.slice(0, 400);
    save(data);
    return snapshot();
  }

  function countWeek(type, wid = weekId()) {
    const data = load();
    return (data.events || []).filter((e) => e.week === wid && e.type === type).length;
  }

  function streak() {
    const data = load();
    const days = new Set(
      (data.events || []).map((e) => new Date(e.at).toISOString().slice(0, 10))
    );
    let n = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function snapshot(targets = DEFAULTS.targets) {
    const wid = weekId();
    const counts = {
      apply: countWeek("apply", wid),
      outreach: countWeek("outreach", wid),
      prep: countWeek("prep", wid),
      boost: countWeek("boost", wid),
    };
    const bars = Object.keys(targets).map((k) => ({
      id: k,
      label: { apply: "Candidatures", outreach: "Outreach", prep: "Prépa", boost: "Boost profil" }[k],
      used: counts[k] || 0,
      max: targets[k],
      pct: Math.min(100, Math.round(((counts[k] || 0) / targets[k]) * 100)),
    }));
    const done = bars.filter((b) => b.used >= b.max).length;
    return {
      week: wid,
      streak: streak(),
      counts,
      bars,
      done,
      totalTargets: bars.length,
      momentum: done >= 3 ? "high" : done >= 1 ? "mid" : "low",
    };
  }

  return { log, snapshot, weekId, DEFAULTS };
})();

window.WeeklyPlan = WeeklyPlan;
