/** AscendOS local-first store */
const AscendStore = (() => {
  const KEY = "ascendos.v1";

  const defaultState = () => ({
    profile: {
      fullName: "",
      headline: "",
      summary: "",
      email: "",
      phone: "",
      website: "",
      salaryExpectation: "",
      country: "France",
      location: "",
      currentTrack: "esn", // esn | end_client | startup | public | other
      targetTrack: "end_client",
      /** Multi-select career upgrade vectors (see CareerVectors.VECTORS) */
      activeVectors: [
        "esn_to_end_client",
        "brand_employer",
        "seniority_climb",
        "scope_budget",
        "skills_capital",
        "platform_leap",
        "compensation",
        "product_over_agency",
        "delivery_to_strategy",
      ],
      yearsExp: 3,
      skills: [],
      experiences: [],
      languages: ["Français", "Anglais"],
      careerGoal: "Obtenir un meilleur job : plus de levier, de rémunération et d'évolution — via la bonne passerelle.",
      linkedinUrl: "",
      aiImports: [],
    },
    jobs: [],
    applyQueue: [],
    cvVersions: [],
    /** Learned email nomenclatures by domain from public samples */
    emailPatterns: {},
    /** RH / CP / hiring managers linked to jobs */
    contacts: [],
    connectors: {
      gmailClientId: "",
      linkedinClientId: "",
      gmailConnected: false,
      linkedinConnected: false,
      lastGeminiImportAt: null,
      adzunaAppId: "",
      adzunaAppKey: "",
    },
    settings: {
      preferEndClient: true,
      minAcceleratorScore: 60,
      locale: "fr",
      dualOutreach: true,
      freshFirst: true,
      freshWindowHours: 24,
      primeUnderMinutes: 60,
      minCareerForPrime: 50,
      jobSourceIds: null,
      customRssFeeds: [],
    },
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const merged = deepMerge(defaultState(), JSON.parse(raw));
      if (!merged.profile.activeVectors || !merged.profile.activeVectors.length) {
        merged.profile.activeVectors =
          typeof CareerVectors !== "undefined"
            ? CareerVectors.defaultsForTrack(merged.profile.currentTrack)
            : defaultState().profile.activeVectors;
      }
      if (!merged.contacts) merged.contacts = [];
      if (!merged.emailPatterns) merged.emailPatterns = {};
      return merged;
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
