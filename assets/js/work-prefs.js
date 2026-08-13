/**
 * WorkPrefs — preferred work arrangements (remote / hybrid / onsite / zones).
 * User checks what they accept; unchecked = out of preference.
 */
const WorkPrefs = (() => {
  const MODES = [
    {
      id: "onsite_local",
      label: "Présentiel (ma zone)",
      blurb: "Bureau près de ma localisation actuelle",
      keywords: ["présentiel", "sur site", "onsite", "on-site", "bureau", "office based", "en agence"],
    },
    {
      id: "hybrid",
      label: "Hybride",
      blurb: "Mix bureau + télétravail",
      keywords: ["hybride", "hybrid", "télétravail partiel", "2j", "3j", "flex office"],
    },
    {
      id: "full_remote",
      label: "Full remote",
      blurb: "100 % à distance",
      keywords: ["full remote", "100% remote", "fully remote", "télétravail complet", "100 % télétravail", "remote only"],
    },
    {
      id: "remote_fr",
      label: "Remote France / FR timezone",
      blurb: "À distance, fuseau / contrat France",
      keywords: ["remote france", "france remote", "télétravail france", "timezone paris", "cet", "cest"],
    },
    {
      id: "remote_eu",
      label: "Remote EU / EMEA",
      blurb: "Europe / EMEA à distance",
      keywords: ["remote eu", "emea", "europe remote", "eu remote", "worldwide europe"],
    },
    {
      id: "remote_world",
      label: "Remote worldwide",
      blurb: "Sans contrainte de pays (si compatible)",
      keywords: ["worldwide", "anywhere", "global remote", "work from anywhere", "nomad"],
    },
    {
      id: "flex_days",
      label: "Flex (1–2 j bureau)",
      blurb: "Très flexible, peu de jours sur site",
      keywords: ["flex", "flexible", "1 jour", "2 jours", "ponctuel"],
    },
    {
      id: "travel_ok",
      label: "Déplacements OK",
      blurb: "Clients / sites / missions terrain acceptés",
      keywords: ["déplacement", "travel", "mission", "terrain", "client site", "mobilité"],
    },
    {
      id: "relocation_ok",
      label: "Mobilité / déménagement OK",
      blurb: "Prêt·e à changer de ville / pays",
      keywords: ["relocation", "déménagement", "mobilité géographique", "expatriation"],
    },
  ];

  const DEFAULT_MODES = ["onsite_local", "hybrid", "full_remote", "remote_fr", "flex_days"];

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function defaultPrefs() {
    return {
      modes: [...DEFAULT_MODES],
      preferredLocations: [],
      excludeLocations: [],
      notes: "",
      configured: false,
    };
  }

  function ensure(profile = {}) {
    const base = defaultPrefs();
    const wp = profile.workPrefs || {};
    return {
      ...base,
      ...wp,
      modes: Array.isArray(wp.modes) ? wp.modes.filter((id) => MODES.some((m) => m.id === id)) : base.modes,
      preferredLocations: Array.isArray(wp.preferredLocations) ? wp.preferredLocations : [],
      excludeLocations: Array.isArray(wp.excludeLocations) ? wp.excludeLocations : [],
    };
  }

  function isConfigured(profile = {}) {
    const wp = ensure(profile);
    return Boolean(wp.configured || (wp.modes && wp.modes.length));
  }

  function detectJobArrangement(job = {}) {
    const blob = normalize(
      [job.title, job.location, job.description, job.tags?.join(" "), job.workMode].join(" \n ")
    );
    const hits = [];
    for (const m of MODES) {
      const n = m.keywords.filter((k) => blob.includes(normalize(k))).length;
      if (n) hits.push({ id: m.id, label: m.label, n });
    }
    // Heuristics on location string
    const loc = normalize(job.location || "");
    if (/remote|teletravail|télétravail|wfh|anywhere/.test(loc) && !hits.some((h) => h.id.startsWith("remote") || h.id === "full_remote")) {
      hits.push({ id: "full_remote", label: "Full remote", n: 1 });
    }
    if (/hybrid|hybride/.test(loc) && !hits.some((h) => h.id === "hybrid")) {
      hits.push({ id: "hybrid", label: "Hybride", n: 1 });
    }
    if (!hits.length && loc && !/remote|tele/.test(loc)) {
      hits.push({ id: "onsite_local", label: "Présentiel (inféré)", n: 1 });
    }
    hits.sort((a, b) => b.n - a.n);
    const primary = hits[0]?.id || "unknown";
    return { primary, hits, label: hits[0]?.label || "Non précisé" };
  }

  function locationOverlap(jobLoc, preferred = [], exclude = []) {
    const jl = normalize(jobLoc);
    if (!jl) return { preferredHit: false, excluded: false };
    const preferredHit = preferred.some((p) => {
      const n = normalize(p);
      return n && (jl.includes(n) || n.includes(jl));
    });
    const excluded = exclude.some((p) => {
      const n = normalize(p);
      return n && (jl.includes(n) || n.includes(jl));
    });
    return { preferredHit, excluded };
  }

  /**
   * Score how well a job matches accepted arrangements.
   * @returns {{ score: number, fit: string, label: string, tone: string, reasons: string[], arrangement: object }}
   */
  function matchJob(job, profile = {}) {
    const wp = ensure(profile);
    const arrangement = detectJobArrangement(job);
    const accepted = new Set(wp.modes || []);
    const reasons = [];

    if (!accepted.size) {
      return {
        score: 50,
        fit: "unset",
        label: "Prefs non définies",
        tone: "warn",
        reasons: ["Coche tes modes (remote / hybride / présentiel) dans le profil."],
        arrangement,
      };
    }

    let score = 45;
    const primaryOk = arrangement.primary !== "unknown" && accepted.has(arrangement.primary);
    const anyHitOk = arrangement.hits.some((h) => accepted.has(h.id));

    if (primaryOk) {
      score += 35;
      reasons.push(`Mode aligné : ${arrangement.label}`);
    } else if (anyHitOk) {
      score += 22;
      reasons.push(`Mode partiellement accepté (${arrangement.hits.filter((h) => accepted.has(h.id)).map((h) => h.label).join(", ")})`);
    } else if (arrangement.primary === "unknown") {
      score += 5;
      reasons.push("Mode offre flou — vérifie l’annonce");
    } else {
      score -= 25;
      reasons.push(`Mode hors préférence : ${arrangement.label}`);
    }

    // Relocation / travel specials
    if (arrangement.hits.some((h) => h.id === "travel_ok") && !accepted.has("travel_ok")) {
      score -= 8;
      reasons.push("Déplacements signalés — non cochés chez toi");
    }
    if (arrangement.hits.some((h) => h.id === "relocation_ok") && !accepted.has("relocation_ok")) {
      // only penalize if job implies move (onsite far) — soft
      score -= 5;
    }

    const loc = locationOverlap(job.location, wp.preferredLocations, wp.excludeLocations);
    if (loc.excluded) {
      score -= 40;
      reasons.push("Zone exclue");
    } else if (loc.preferredHit) {
      score += 18;
      reasons.push(`Zone préférée : ${job.location}`);
    } else if (wp.preferredLocations?.length && arrangement.primary === "onsite_local") {
      score -= 12;
      reasons.push("Présentiel hors zones préférées");
    }

    // Home base soft match
    const home = normalize(profile.location || "");
    if (home && arrangement.primary === "onsite_local") {
      const jl = normalize(job.location || "");
      if (jl && (jl.includes(home) || home.includes(jl.split(/[/,]/)[0]?.trim()))) {
        score += 10;
        reasons.push("Proche de ta localisation");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let fit = "ok";
    let tone = "lime";
    let label = "Compatible";
    if (score >= 75) {
      fit = "strong";
      tone = "ok";
      label = "Très aligné lieu/mode";
    } else if (score >= 50) {
      fit = "ok";
      tone = "lime";
      label = "Acceptable";
    } else if (score >= 35) {
      fit = "weak";
      tone = "warn";
      label = "Limite";
    } else {
      fit = "no";
      tone = "bad";
      label = "Hors préférences";
    }

    return { score, fit, label, tone, reasons, arrangement };
  }

  function summaryText(profile = {}) {
    const wp = ensure(profile);
    const labels = MODES.filter((m) => wp.modes.includes(m.id)).map((m) => m.label);
    const zones = wp.preferredLocations?.length ? ` · Zones : ${wp.preferredLocations.join(", ")}` : "";
    const home = profile.location ? `Base : ${profile.location}` : "";
    return [home, labels.length ? `Accepté : ${labels.join(" · ")}` : "Aucun mode coché", zones].filter(Boolean).join(" | ");
  }

  /** Interactive prompts when prefs never configured */
  async function interactiveConfigure(profile = {}, askFn) {
    const ask =
      askFn ||
      (async (q, prev) => {
        const v = window.prompt(q, prev || "");
        return v == null ? null : v;
      });

    const patch = { modes: [], preferredLocations: [], configured: true };

    const home = await ask(
      "Localisation de base (ville / zone) ? Laisse vide pour garder l’actuelle.",
      profile.location || ""
    );
    if (home === null) return null; // cancelled
    if (String(home).trim()) patch.location = String(home).trim();

    const zones = await ask(
      "Villes / zones ciblées (virgules). Ex: Paris, Lyon, Remote FR — vide = pas de filtre zone.",
      (profile.workPrefs?.preferredLocations || []).join(", ")
    );
    if (zones === null) return null;
    patch.preferredLocations = String(zones)
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Pose each major mode yes/no — user can decline
    const toAsk = [
      "onsite_local",
      "hybrid",
      "full_remote",
      "remote_fr",
      "remote_eu",
      "remote_world",
      "flex_days",
      "travel_ok",
      "relocation_ok",
    ];
    for (const id of toAsk) {
      const m = MODES.find((x) => x.id === id);
      const def = DEFAULT_MODES.includes(id) ? "o" : "n";
      const ans = await ask(`${m.label} — accepter ? (o/n) [${def}]`, def);
      if (ans === null) return null;
      const yes = /^o|y|oui|yes|1|true$/i.test(String(ans).trim() || def);
      if (yes) patch.modes.push(id);
    }

    if (!patch.modes.length) {
      // Fail-safe: keep hybrid + remote fr so ranking still works
      patch.modes = ["hybrid", "full_remote", "remote_fr"];
    }

    return patch;
  }

  function applyPatch(profile, patch) {
    const next = { ...profile };
    if (patch.location) next.location = patch.location;
    next.workPrefs = {
      ...ensure(profile),
      modes: patch.modes || ensure(profile).modes,
      preferredLocations: patch.preferredLocations ?? ensure(profile).preferredLocations,
      excludeLocations: patch.excludeLocations ?? ensure(profile).excludeLocations,
      notes: patch.notes ?? ensure(profile).notes,
      configured: true,
    };
    return next;
  }

  function missingPrompt(profile = {}) {
    const wp = ensure(profile);
    if (wp.configured && wp.modes.length) return null;
    return {
      key: "workPrefs",
      label: "Lieu / remote / hybride",
      ask: "Configurer tes modes de travail acceptés ?",
    };
  }

  return {
    MODES,
    DEFAULT_MODES,
    defaultPrefs,
    ensure,
    isConfigured,
    detectJobArrangement,
    matchJob,
    summaryText,
    interactiveConfigure,
    applyPatch,
    missingPrompt,
  };
})();

window.WorkPrefs = WorkPrefs;
