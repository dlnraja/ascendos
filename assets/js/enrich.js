/**
 * PublicEnrich — fill YOUR gaps from YOUR public footprints + interactive asks.
 * Ethics: self-data only · public/open sources · no private scrape · no ATS bypass.
 */
const PublicEnrich = (() => {
  const REQUIRED = [
    { key: "fullName", label: "Nom complet", ask: "Quel est ton nom complet ?" },
    { key: "email", label: "Email", ask: "Quel email utiliser pour les candidatures ?" },
    { key: "phone", label: "Téléphone", ask: "Numéro de téléphone (avec indicatif) ?" },
    { key: "linkedinUrl", label: "URL profil public", ask: "URL de ton profil public (réseau pro) ?" },
    { key: "location", label: "Ville / zone", ask: "Ville ou zone (ex: Paris / Remote EU) ?" },
    { key: "headline", label: "Headline", ask: "Headline en une ligne ?" },
    { key: "summary", label: "Résumé", ask: "Résumé pro (3–6 lignes, faits réels) ?" },
    { key: "salaryExpectation", label: "Prétentions", ask: "Fourchette salariale (ex: 55-65k) ?" },
    { key: "website", label: "Site / portfolio", ask: "URL portfolio / site (ou vide) ?" },
  ];

  function missingFields(profile = {}) {
    return REQUIRED.filter((f) => {
      const v = profile[f.key];
      if (Array.isArray(v)) return !v.length;
      return !String(v || "").trim();
    });
  }

  function missingForAutofill(profile = {}) {
    const need = ["fullName", "email", "phone", "linkedinUrl", "location", "summary"];
    return REQUIRED.filter((f) => need.includes(f.key) && !String(profile[f.key] || "").trim());
  }

  /** Deep links the user opens — browser talks to the source, not AscendOS servers. */
  function publicSourceLinks(profile = {}) {
    const name = encodeURIComponent(profile.fullName || "");
    const li = profile.linkedinUrl || "";
    return [
      {
        id: "linkedin_public",
        label: "Profil public réseau pro",
        href: li || (name ? `https://www.google.com/search?q=${name}+site%3Alinkedin.com%2Fin` : "https://www.linkedin.com/in/me/"),
        blurb: "Ouvre ton profil public · copie vers Import",
      },
      {
        id: "workspace",
        label: "Google Docs / Drive",
        href: "https://docs.google.com/document/u/0/",
        blurb: "Exporte CV → colle dans AI Vault (Workspace accessible = ton compte)",
      },
      {
        id: "gmail",
        label: "Gmail (brouillons)",
        href: "https://mail.google.com/mail/u/0/#inbox",
        blurb: "Session mail locale — pas de sync AscendOS",
      },
      {
        id: "hal",
        label: "HAL (publications FR)",
        href: name ? `https://hal.science/search/index/?q=${name}` : "https://hal.science/",
        blurb: "Publications scientifiques publiques",
      },
      {
        id: "orcid",
        label: "ORCID",
        href: name ? `https://orcid.org/orcid-search/search?searchQuery=${name}` : "https://orcid.org/",
        blurb: "Identifiant chercheur public",
      },
      {
        id: "data_gouv",
        label: "data.gouv.fr",
        href: name ? `https://www.data.gouv.fr/fr/search/?q=${name}` : "https://www.data.gouv.fr/fr/",
        blurb: "Jeux ouverts (si présents — souvent orga, pas perso)",
      },
      {
        id: "wikidata",
        label: "Wikidata",
        href: name ? `https://www.wikidata.org/w/index.php?search=${name}` : "https://www.wikidata.org/",
        blurb: "Fiche publique éventuelle",
      },
      {
        id: "web_public",
        label: "Recherche web publique",
        href: name
          ? `https://www.google.com/search?q=${name}+CV+OR+diplôme+OR+portfolio`
          : "https://www.google.com/",
        blurb: "Pages publiques te concernant — à coller manuellement",
      },
    ];
  }

  /** CORS-friendly public hint (Wikidata search). Never invents facts. */
  async function fetchWikidataHints(fullName) {
    const q = String(fullName || "").trim();
    if (!q) return { ok: false, hits: [] };
    if (typeof AscendQuotas !== "undefined") {
      try {
        AscendQuotas.consume("enrich_public");
      } catch (e) {
        return { ok: false, hits: [], error: e.message };
      }
    }
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
        q
      )}&language=fr&uselang=fr&format=json&origin=*&limit=5`;
      const res = await (typeof AscendResilience !== "undefined"
        ? AscendResilience.fetch(url, { timeoutMs: 7000 })
        : fetch(url));
      if (!res.ok) return { ok: false, hits: [], degraded: true, error: `HTTP ${res.status}` };
      const data = await res.json();
      const hits = (data.search || []).map((h) => ({
        id: h.id,
        label: h.label,
        description: h.description || "",
        url: `https://www.wikidata.org/wiki/${h.id}`,
      }));
      return { ok: true, hits };
    } catch (e) {
      return { ok: false, hits: [], degraded: true, error: e.message || "Wikidata down" };
    }
  }

  /**
   * Interactive fill: asks only missing fields via provided askFn (async (question)=>string).
   */
  async function interactiveFill(profile, { fields = null, askFn } = {}) {
    const missing = fields || missingForAutofill(profile);
    const patch = {};
    for (const f of missing) {
      const answer = await askFn(f.ask, profile[f.key] || "");
      if (answer != null && String(answer).trim()) patch[f.key] = String(answer).trim();
    }
    return patch;
  }

  function applyPatch(profile, patch = {}) {
    const out = { ...profile };
    for (const [k, v] of Object.entries(patch)) {
      if (v != null && String(v).trim()) out[k] = typeof v === "string" ? v.trim() : v;
    }
    return out;
  }

  function educationFromPaste(text) {
    const lines = String(text || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const edu = [];
    for (const line of lines) {
      if (/diplôme|master|licence|bachelor|mba|ingénieur|bts|dut|phd|doctorat|école|université/i.test(line)) {
        edu.push(line.slice(0, 180));
      }
    }
    return edu;
  }

  return {
    REQUIRED,
    missingFields,
    missingForAutofill,
    publicSourceLinks,
    fetchWikidataHints,
    interactiveFill,
    applyPatch,
    educationFromPaste,
  };
})();

window.PublicEnrich = PublicEnrich;
