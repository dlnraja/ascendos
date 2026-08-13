/**
 * Career Vectors — full upgrade taxonomy for AscendOS.
 * Inspired by patterns used by high-performing careerists:
 * - Career capital / rare & valuable skills (Newport, 80,000 Hours)
 * - Knowing-why / how / whom (intelligent career)
 * - Tour of duty / platform leaps (Reid Hoffman)
 * - Boundaryless & protean careers (self-directed moves)
 * - Classic ladders: seniority, ownership, brand, compensation, domain
 *
 * ESN → client final is ONE vector among many — not the whole product.
 */
const CareerVectors = (() => {
  const CATEGORIES = [
    { id: "employeur", label: "Employeur & marque" },
    { id: "niveau", label: "Niveau & responsabilités" },
    { id: "capital", label: "Capital de carrière" },
    { id: "economie", label: "Économie & conditions" },
    { id: "direction", label: "Direction & sens" },
  ];

  /**
   * Each vector: detection hints in job text, positive/negative signals,
   * playbook tips from how successful movers actually upgrade.
   */
  const VECTORS = [
    {
      id: "esn_to_end_client",
      category: "employeur",
      label: "ESN / conseil → client final",
      short: "Sortir de la régie",
      blurb: "Passer du staffing / mission à un poste internalisé chez le client ou un éditeur.",
      playbook:
        "Les transitions réussies vendent l'expérience multi-clients comme preuve d'adaptabilité, puis ciblent ownership produit. Éviter une énième ESN « mieux payée » si le but est le levier long terme.",
      positive: [
        "client final",
        "end client",
        "in-house",
        "interne",
        "cdi interne",
        "équipe produit",
        "éditeur",
        "saas",
        "produit digital",
      ],
      negative: [
        "esn",
        "ssii",
        "régie",
        "tjm",
        "assistance technique",
        "prestataire",
        "body shopping",
        "mission chez client",
        "staffing",
      ],
      defaultOnFor: ["esn"],
    },
    {
      id: "brand_employer",
      category: "employeur",
      label: "Marque employeur / signal CV",
      short: "Marque forte",
      blurb: "Rejoindre un employeur dont le nom ouvre des portes (CAC40, scale-up connue, GAFAM, unicorn).",
      playbook:
        "Les careerists utilisent 2–4 ans chez une marque forte comme credential. Prioriser le signal pour le marché suivant, pas seulement le titre.",
      positive: [
        "cac 40",
        "cac40",
        "fortune 500",
        "unicorn",
        "scale-up",
        "scaleup",
        "faang",
        "gafam",
        "nasdaq",
        "leader mondial",
        "référence marché",
        "série b",
        "série c",
        "unicorn",
      ],
      negative: ["inconnu", "tpe", "très petite"],
      defaultOnFor: ["esn", "startup", "other"],
    },
    {
      id: "product_over_agency",
      category: "employeur",
      label: "Agence / delivery → produit",
      short: "Vers le produit",
      blurb: "Quitter le mode projet/agence pour construire un produit durable.",
      playbook:
        "Recadrer les livrables projets en outcomes produit (rétention, roadmap, utilisateurs). Les meilleurs pivots insistent sur ownership multi-releases.",
      positive: ["product", "produit", "roadmap", "backlog", "pmf", "users", "utilisateurs", "feature", "saas"],
      negative: ["agence", "campagne client", "au forfait", "projet au forfait", "studio"],
      defaultOnFor: ["esn", "other"],
    },
    {
      id: "startup_to_scale",
      category: "employeur",
      label: "Startup early → scale / structuré",
      short: "Scale-up",
      blurb: "Passer d'un environnement chaotique early-stage à une orga qui scale.",
      playbook:
        "Vendre le bias for action startup + chercher process, mentors et scope plus large. Éviter de rejouer le même chaos sans equity upside.",
      positive: ["scale-up", "scaleup", "série b", "série c", "growth", "structuring", "process", "équipe de"],
      negative: ["pre-seed", "idée stage", "0–1 only", "tout faire"],
      defaultOnFor: ["startup"],
    },
    {
      id: "corp_to_ownership",
      category: "employeur",
      label: "Grand groupe figé → ownership",
      short: "Plus d'ownership",
      blurb: "Quitter une boîte où tu es un rouage pour un rôle avec vraie prise de décision.",
      playbook:
        "Chercher end-to-end ownership, petit blast radius élevé, accès décideurs. Les movers réussis négocient le scope avant le titre.",
      positive: ["ownership", "autonomie", "end-to-end", "décision", "impact direct", "0 to 1", "builder"],
      negative: ["process lourd", "validation multiple", "reporting uniquement"],
      defaultOnFor: ["end_client"],
    },
    {
      id: "seniority_climb",
      category: "niveau",
      label: "Montée de séniorité / titre",
      short: "Niveau +1",
      blurb: "Junior→Confirmé→Senior→Staff/Lead→Principal/Director.",
      playbook:
        "Les progressions rapides prouvent déjà le niveau supérieur (scope, mentoring, incidents). Demander le titre qui match le travail déjà fait.",
      positive: [
        "senior",
        "lead",
        "staff",
        "principal",
        "head of",
        "directeur",
        "director",
        "architect",
        "engineering manager",
        "tech lead",
        "responsable",
      ],
      negative: ["junior", "stage", "alternance", "entry level", "débutant"],
      defaultOnFor: ["*"],
    },
    {
      id: "ic_to_management",
      category: "niveau",
      label: "Expert → management d'équipe",
      short: "People mgmt",
      blurb: "Passer d'IC à manager (EM, team lead, responsable d'équipe).",
      playbook:
        "Montrer mentoring, hiring help, delivery d'équipe. Ne pas viser management pour « fuir » l'IC — viser le levier collectif.",
      positive: [
        "manager",
        "management",
        "équipe de",
        "encadrement",
        "n+1",
        "people manager",
        "engineering manager",
        "responsable d'équipe",
        "hire",
        "recruter",
      ],
      negative: ["individual contributor only", "pas de management"],
      defaultOnFor: [],
    },
    {
      id: "staff_ic_track",
      category: "niveau",
      label: "Voie Staff / Principal (sans management)",
      short: "Staff IC",
      blurb: "Progresser en influence technique sans devenir people manager.",
      playbook:
        "Les meilleurs Staff IC documentent des wins transverses, design reviews, standards. Cibler les boîtes avec double ladder.",
      positive: ["staff", "principal", "distinguished", "fellow", "ic track", "dual ladder", "expert métier"],
      negative: ["obligatoire manager", "seul avancement = management"],
      defaultOnFor: [],
    },
    {
      id: "scope_budget",
      category: "niveau",
      label: "Scope : budget, équipe, P&L",
      short: "Plus de scope",
      blurb: "Augmenter le périmètre (budget, headcount, P&L, multi-squad).",
      playbook:
        "Quantifier ton scope actuel puis cibler +30–100%. Les careerists parlent en €, personnes, et outcomes — pas en tâches.",
      positive: ["budget", "p&l", "pnl", "headcount", "multi-équipe", "squad", "tribe", "portfolio", "okrs"],
      negative: ["exécutant", "ticket only"],
      defaultOnFor: ["*"],
    },
    {
      id: "delivery_to_strategy",
      category: "niveau",
      label: "Exécution → stratégie / architecture",
      short: "Stratégie",
      blurb: "Monter d'implémenteur à architecte, stratège, ou design de systèmes.",
      playbook:
        "Montrer des décisions trade-off, vision technique, alignement business. Portfolio de décisions > liste de tickets.",
      positive: [
        "architecture",
        "stratégie",
        "strategy",
        "vision",
        "roadmap",
        "design system",
        "principal",
        "staff",
        "trade-off",
      ],
      negative: ["exécution pure", "run only", "maintenance uniquement"],
      defaultOnFor: ["*"],
    },
    {
      id: "skills_capital",
      category: "capital",
      label: "Capital compétences rares",
      short: "Skills rares",
      blurb: "Job qui construit des skills rares et valorisables (AI, cloud, domain deep, leadership).",
      playbook:
        "Craftsman mindset : choisir le rôle pour le taux d'apprentissage + feedback, pas le confort. Audit : « qu'est-ce que j'aurai d'unique dans 18 mois ? »",
      positive: [
        "mentor",
        "formation",
        "cutting-edge",
        "ia",
        "ai ",
        "machine learning",
        "llm",
        "cloud",
        "kubernetes",
        "platform",
        "r&d",
        "innovation",
      ],
      negative: ["legacy only", "cobol only", "aucune montée en compétence"],
      defaultOnFor: ["*"],
    },
    {
      id: "network_whom",
      category: "capital",
      label: "Réseau & sponsors (knowing-whom)",
      short: "Réseau",
      blurb: "Environnement dense en mentors, sponsors, pairs de haut niveau.",
      playbook:
        "Les sauts les plus rapides passent par weak ties + sponsors. Cibler des boîtes/communautés où les alumni placent bien.",
      positive: [
        "mentor",
        "coaching",
        "communauté",
        "alumni",
        "chapter",
        "guild",
        "conference",
        "open source",
        "thought leadership",
      ],
      negative: [],
      defaultOnFor: [],
    },
    {
      id: "credentials_visibility",
      category: "capital",
      label: "Credentials & visibilité",
      short: "Visibilité",
      blurb: "Preuves publiques : marque, publications, conférences, GitHub, patents.",
      playbook:
        "Ce qui se montre se monétise au job suivant. Négocier du temps pour parler / publier / open-source.",
      positive: ["conférenc", "speaker", "publication", "open source", "github", "brevet", "patent", "blog", "public"],
      negative: [],
      defaultOnFor: [],
    },
    {
      id: "platform_leap",
      category: "capital",
      label: "Tour of duty / plateforme suivante",
      short: "Plateforme",
      blurb: "Un mandat qui maximise les options dans 2–3 ans (pas un cul-de-sac).",
      playbook:
        "Reid Hoffman : chaque job = tour of duty avec mission claire et next platform. Demande : « où vont les alumni dans 3 ans ? »",
      positive: ["évolutif", "passerelle", "mobilit", "parcours", "fast track", "high potential", "talent program"],
      negative: ["cul-de-sac", "aucun avancement", "gel des promotions"],
      defaultOnFor: ["*"],
    },
    {
      id: "industry_switch",
      category: "direction",
      label: "Pivot industrie / domaine",
      short: "Pivot industrie",
      blurb: "Changer de secteur de façon stratégique (fintech, health, climate, defense…).",
      playbook:
        "Traduire les skills transferables + 1 preuve domaine (side project, certif, mission). Les pivots réussis ciblent des boîtes qui recrutent des adjacent talents.",
      positive: ["fintech", "healthtech", "climate", "greentech", "defense", "deeptech", "biotech", "edtech", "mobility"],
      negative: [],
      defaultOnFor: [],
    },
    {
      id: "support_to_revenue",
      category: "direction",
      label: "Support / ops → produit / revenue",
      short: "Vers le revenue",
      blurb: "Se rapprocher du cœur de valeur (produit, sales eng, growth, core eng).",
      playbook:
        "Les rôles proches du P&L se négocient mieux. Bridge via projects transverses avant le saut.",
      positive: ["growth", "revenue", "product", "core", "customer-facing", "sales engineer", "monétisation"],
      negative: ["helpdesk only", "ticket queue", "back-office only"],
      defaultOnFor: [],
    },
    {
      id: "mission_impact",
      category: "direction",
      label: "Mission / impact sociétal",
      short: "Impact",
      blurb: "Aligner le job sur une mission (climate, health, education, public interest).",
      playbook:
        "80k Hours : combiner impact + career capital. Éviter les titres « impact washing » sans levier réel.",
      positive: ["impact", "mission", "climate", "santé", "éducation", "intérêt général", "esg", "sustainab"],
      negative: [],
      defaultOnFor: [],
    },
    {
      id: "geo_market",
      category: "economie",
      label: "Marché / géographie",
      short: "Geo / marché",
      blurb: "Accéder à un marché plus riche (hub, international, remote EU/US pay bands).",
      playbook:
        "Un même skill set paie très différemment selon le marché. Remote international = levier sous-estimé.",
      positive: ["international", "remote", "worldwide", "emea", "london", "new york", "dublin", "amsterdam", "suisse"],
      negative: ["mobilité forcée non désirée"],
      defaultOnFor: [],
    },
    {
      id: "compensation",
      category: "economie",
      label: "Compensation & equity",
      short: "Package",
      blurb: "Salaire, bonus, intéressement, BSPCE / RSU, total cash.",
      playbook:
        "Négocier sur données de marché. Equity liquide > paper shares. Les tops comparent total comp, pas le fixe seul.",
      positive: [
        "bspce",
        "rsu",
        "stock options",
        "intéressement",
        "participation",
        "bonus",
        "package",
        "rémunération attractive",
        "above market",
      ],
      negative: ["sous-marché", "pas de cadre"],
      defaultOnFor: ["*"],
    },
    {
      id: "autonomy_flexibility",
      category: "economie",
      label: "Autonomie & flexibilité",
      short: "Autonomie",
      blurb: "Remote, RTT, async, contrôle du calendrier — conditions rare & valuable.",
      playbook:
        "Newport : l'autonomie s'achète avec du capital. Négocier flex après preuve de delivery, ou cibler cultures déjà async.",
      positive: ["remote", "télétravail", "full remote", "async", "flex", "rtt", "4 day", "autonomie", "hybrid"],
      negative: ["présentiel obligatoire 5j", "pointage"],
      defaultOnFor: [],
    },
    {
      id: "stability_runway",
      category: "economie",
      label: "Stabilité & runway",
      short: "Stabilité",
      blurb: "CDI solide, trésorerie entreprise, benefits — réduire le risque.",
      playbook:
        "Utile après une période volatile. Vérifier runway, turn-over, et clause. Stabilité ≠ stagnation : garder un vecteur skills.",
      positive: ["cdi", "stable", "mutuelle", "prévoyance", "comité d'entreprise", "runway", "rentable"],
      negative: ["plan social", "funding risk", "3 mois de runway"],
      defaultOnFor: [],
    },
    {
      id: "founder_path",
      category: "direction",
      label: "Préparation indie / founder",
      short: "Vers fonder",
      blurb: "Rôle qui prépare à créer (0→1, customers, full-stack ownership).",
      playbook:
        "Chercher customer contact, shipping rapide, et equity learning. Beaucoup de founders viennent de roles « generalist ownership ».",
      positive: ["0 to 1", "0→1", "founder", "intrapreneur", "customer discovery", "mvp", "build"],
      negative: [],
      defaultOnFor: [],
    },
  ];

  function byId(id) {
    return VECTORS.find((v) => v.id === id);
  }

  function defaultsForTrack(track) {
    return VECTORS.filter(
      (v) => v.defaultOnFor.includes("*") || v.defaultOnFor.includes(track || "other")
    ).map((v) => v.id);
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function countHits(hay, needles) {
    return (needles || []).filter((n) => n && hay.includes(normalize(n))).length;
  }

  /**
   * Score one vector against a job blob. Returns 0–100.
   */
  function scoreVector(vector, blob, profile = {}) {
    const pos = countHits(blob, vector.positive);
    const neg = countHits(blob, vector.negative);
    let score = 45 + pos * 12 - neg * 14;

    // Personalization nudges
    if (vector.id === "esn_to_end_client") {
      if (profile.currentTrack === "esn") score += 6;
      if ((profile.currentTrack === "esn" || profile.targetTrack === "end_client") && neg > pos) score -= 8;
    }
    if (vector.id === "seniority_climb" && (profile.yearsExp || 0) >= 3 && pos > 0) score += 4;
    if (vector.id === "skills_capital") {
      const skills = (profile.skills || []).map(normalize);
      const skillHits = skills.filter((s) => s.length > 2 && blob.includes(s)).length;
      score += Math.min(10, skillHits);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function detectEmployerType(blob, job = {}) {
    if (job.employerType && job.employerType !== "unknown") return job.employerType;
    const esn = countHits(blob, byId("esn_to_end_client").negative);
    const end = countHits(blob, byId("esn_to_end_client").positive);
    if (end > esn) return "end_client";
    if (esn > 0) return "esn";
    return "unclear";
  }

  /**
   * Full multi-vector score for a job given active vector ids.
   */
  function scoreJob(job, profile = {}) {
    const blob = normalize(
      [job.title, job.company, job.description, job.tags?.join(" "), job.employerType].join(" \n ")
    );

    const activeIds =
      profile.activeVectors && profile.activeVectors.length
        ? profile.activeVectors
        : defaultsForTrack(profile.currentTrack || profile.targetTrack);

    const vectorBreakdown = [];
    let weighted = 0;
    let weightSum = 0;

    for (const id of activeIds) {
      const v = byId(id);
      if (!v) continue;
      const s = scoreVector(v, blob, profile);
      vectorBreakdown.push({
        id: v.id,
        label: v.label,
        short: v.short,
        category: v.category,
        score: s,
        playbook: v.playbook,
      });
      weighted += s;
      weightSum += 1;
    }

    // Always compute skill overlap bonus on composite
    const skills = (profile.skills || []).map(normalize);
    const skillHits = skills.filter((s) => s && blob.includes(s)).length;
    let composite = weightSum ? weighted / weightSum : 40;
    if (skillHits > 0) {
      composite += Math.min(10, skillHits * 1.5);
    }

    // Slight boost if top vectors are all strong
    const strongCount = vectorBreakdown.filter((x) => x.score >= 70).length;
    if (strongCount >= 3) composite += 4;

    composite = Math.max(0, Math.min(100, Math.round(composite)));

    vectorBreakdown.sort((a, b) => b.score - a.score);

    let label = "Neutre";
    let tone = "warn";
    if (composite >= 75) {
      label = "Upgrade fort";
      tone = "ok";
    } else if (composite >= 60) {
      label = "Bon levier";
      tone = "lime";
    } else if (composite >= 40) {
      label = "Transition possible";
      tone = "warn";
    } else {
      label = "Faible upgrade";
      tone = "bad";
    }

    const top = vectorBreakdown.slice(0, 3);
    const reasons = top.map(
      (t) => `${t.short || t.label} : ${t.score}/100 — ${t.score >= 60 ? "aligné" : "faible signal"}`
    );
    if (skillHits > 0) reasons.push(`${skillHits} compétence(s) du profil matchent l'offre.`);
    if (!activeIds.length) reasons.push("Aucun vecteur actif — active-en dans ton profil.");

    return {
      score: composite,
      label,
      tone,
      employerType: detectEmployerType(blob, job),
      reasons,
      vectors: vectorBreakdown,
      activeVectorIds: activeIds,
      signals: { skillHits, strongCount },
    };
  }

  function rankJobs(jobs, profile) {
    return [...jobs]
      .map((j) => ({ ...j, accelerator: scoreJob(j, profile) }))
      .sort((a, b) => b.accelerator.score - a.accelerator.score);
  }

  function recommendVectors(profile) {
    const base = defaultsForTrack(profile.currentTrack);
    const extras = [];
    if ((profile.yearsExp || 0) >= 5) extras.push("ic_to_management", "scope_budget", "staff_ic_track");
    if (profile.targetTrack === "startup") extras.push("corp_to_ownership", "founder_path");
    if (profile.targetTrack === "end_client") extras.push("esn_to_end_client", "brand_employer", "product_over_agency");
    return [...new Set([...base, ...extras])];
  }

  return {
    CATEGORIES,
    VECTORS,
    byId,
    defaultsForTrack,
    scoreJob,
    rankJobs,
    recommendVectors,
    scoreVector,
  };
})();

window.CareerVectors = CareerVectors;
