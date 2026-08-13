/** AscendOS local-first store */
const AscendStore = (() => {
  const KEY = "ascendos.v1";

  const defaultState = () => ({
    profile: {
      fullName: "",
      headline: "",
      summary: "",
      email: "",
      location: "",
      currentTrack: "esn", // esn | end_client | startup | public | other
      targetTrack: "end_client",
      yearsExp: 3,
      skills: [],
      experiences: [],
      languages: ["Français", "Anglais"],
      careerGoal: "Passer d'une ESN à un grand groupe client final avec plus d'ownership produit.",
      linkedinUrl: "",
      aiImports: [],
    },
    jobs: [],
    applyQueue: [],
    cvVersions: [],
    connectors: {
      gmailClientId: "",
      linkedinClientId: "",
      gmailConnected: false,
      linkedinConnected: false,
      lastGeminiImportAt: null,
    },
    settings: {
      preferEndClient: true,
      minAcceleratorScore: 60,
      locale: "fr",
    },
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return deepMerge(defaultState(), JSON.parse(raw));
    } catch {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function deepMerge(base, patch) {
    if (Array.isArray(base)) return Array.isArray(patch) ? patch : base;
    if (typeof base !== "object" || base === null) return patch ?? base;
    const out = { ...base };
    for (const k of Object.keys(patch || {})) {
      out[k] = k in base ? deepMerge(base[k], patch[k]) : patch[k];
    }
    return out;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  }

  return { load, save, uid, defaultState };
})();

window.AscendStore = AscendStore;
