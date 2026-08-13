/**
 * Passerelles & coups de levier — all careers, not just tech.
 * Maps LinkedIn-like profiles → honest upgrade directions, bridges,
 * compensation leaps, and CV framing without fabricating experience.
 */
const Passerelles = (() => {
  /**
   * Profession families — detection from headline / about / skills / titles.
   */
  const FAMILIES = [
    {
      id: "tech",
      label: "Tech / digital / data",
      hints: [
        "developpeur",
        "developer",
        "ingenieur",
        "software",
        "devops",
        "data",
        "cloud",
        "cyber",
        "product owner",
        "scrum",
        "fullstack",
        "backend",
        "frontend",
        "qa ",
        "sre",
      ],
    },
    {
      id: "sales",
      label: "Vente / business development",
      hints: [
        "commercial",
        "sales",
        "account executive",
        "business develop",
        "adv",
        "vendeur",
        "key account",
        "sdr",
        "bdr",
        "revenue",
      ],
    },
    {
      id: "marketing",
      label: "Marketing / growth / comm",
      hints: [
        "marketing",
        "growth",
        "brand",
        "communication",
        "content",
        "seo",
        "social media",
        "community",
        "crm marketing",
      ],
    },
    {
      id: "finance",
      label: "Finance / compta / audit",
      hints: [
        "finance",
        "comptable",
        "controller",
        "audit",
        "treasury",
        "trésorerie",
        "fp&a",
        "analyst financier",
        "expertise comptable",
        "banque",
      ],
    },
    {
      id: "hr",
      label: "RH / talent / people",
      hints: ["ressources humaines", " rh", "talent", "recruteur", "recruiter", "hrbp", "paie", "formation", "people"],
    },
    {
      id: "ops",
      label: "Ops / supply / logistique",
      hints: [
        "operations",
        "logistique",
        "supply",
        "achat",
        "procurement",
        "qualité",
        "lean",
        "production",
        "ordonnancement",
      ],
    },
    {
      id: "healthcare",
      label: "Santé / médico-social",
      hints: [
        "infirmier",
        "medecin",
        "médecin",
        "pharmacien",
        "aide-soignant",
        "kine",
        "sage-femme",
        "hopital",
        "hôpital",
        "clinique",
        "soignant",
      ],
    },
    {
      id: "education",
      label: "Éducation / formation",
      hints: ["enseignant", "professeur", "formateur", "pedagog", "éducation", "education", "université", "école"],
    },
    {
      id: "legal",
      label: "Juridique / compliance",
      hints: ["juriste", "avocat", "legal", "compliance", "contrat", "rgpd", "dpo", "notaire"],
    },
    {
      id: "creative",
      label: "Créatif / design / média",
      hints: ["designer", "graphiste", "ux", "ui ", "directeur artistique", "video", "journaliste", "redacteur", "créatif"],
    },
    {
      id: "public",
      label: "Public / associatif",
      hints: ["fonction publique", "territorial", "ministere", "collectivité", "association", "ong", "service public"],
    },
    {
      id: "hospitality",
      label: "Hôtellerie / restauration / tourisme",
      hints: ["hotel", "hôtel", "restaurant", "cuisine", "sommelier", "tourism", "reception", "hôtellerie"],
    },
    {
      id: "trades",
      label: "Métiers / artisanat / terrain",
      hints: [
        "technicien",
        "electricien",
        "plombier",
        "chaudronnier",
        "maintenance",
        "chantier",
        "conducteur de travaux",
        "artisan",
      ],
    },
    {
      id: "customer",
      label: "Relation client / support",
      hints: ["customer success", "support", "sav", "hotline", "conseiller client", "helpdesk", "relation client"],
    },
    {
      id: "management",
      label: "Management / direction",
      hints: ["directeur", "manager", "chef de service", "responsable", "head of", "ceo", "coo", "dg ", "dirigeant"],
    },
    {
      id: "consulting",
      label: "Conseil / audit / ESN",
      hints: ["consultant", "conseil", "esn", "ssii", "cabinet", "mission client", "advisory"],
    },
  ];

  /**
   * Bridges: fromFamily → toFamily with honest transferable angles + pay/accel note.
   */
  const BRIDGES = [
    {
      from: "consulting",
      to: "tech",
      title: "Conseil / ESN → poste interne tech/produit",
      leverage: "high",
      payLift: "medium-high",
      transferable: ["multi-clients", "delivery sous contrainte", "communication stakeholder", "domain exposure"],
      cvAngle:
        "Recadrer les missions comme ownership de livrables, stakeholders, et résultats mesurables — sans inventer un titre « Product » non tenu.",
      breakChance: "Poste interne chez un ancien client où tu as déjà la crédibilité.",
    },
    {
      from: "consulting",
      to: "finance",
      title: "Conseil → finance d'entreprise / contrôle",
      leverage: "high",
      payLift: "high",
      transferable: ["analyse", "reporting client", "process", "excel/modélisation"],
      cvAngle: "Mettre en avant analyses chiffrées, process, et décisions aidées — preuves existantes seulement.",
      breakChance: "Contrôle de gestion / FP&A dans un secteur déjà côtoyé en mission.",
    },
    {
      from: "customer",
      to: "sales",
      title: "Support / CS → vente / account",
      leverage: "high",
      payLift: "high",
      transferable: ["écoute client", "objections", "produit", "fidélisation"],
      cvAngle: "Chiffrer rétention, upsell assistés, satisfaction — ne pas inventer un quota sales.",
      breakChance: "Passage SDR/AE inbound sur le même produit que tu supportes déjà.",
    },
    {
      from: "customer",
      to: "ops",
      title: "Support → ops / process / qualité",
      leverage: "medium",
      payLift: "medium",
      transferable: ["process", "tickets", "escalades", "connaissance terrain"],
      cvAngle: "Valoriser amélioration continue et réduction de volume tickets avec faits.",
      breakChance: "Rôle process owner / qualité client dans la même boîte.",
    },
    {
      from: "sales",
      to: "management",
      title: "Commercial → head of sales / manager",
      leverage: "high",
      payLift: "high",
      transferable: ["quota", "pipeline", "closing", "coaching juniors"],
      cvAngle: "Montrer mentoring informel et wins d'équipe avant le titre manager.",
      breakChance: "Team lead sur un segment que tu domines déjà.",
    },
    {
      from: "sales",
      to: "marketing",
      title: "Vente → growth / partnerships",
      leverage: "medium",
      payLift: "medium",
      transferable: ["message marché", "objections", "ICP", "feedback terrain"],
      cvAngle: "Relier feedback clients à des tests message — sans prétendre gérer des campagnes non faites.",
      breakChance: "Growth role dans une scale-up qui valorise le terrain sales.",
    },
    {
      from: "finance",
      to: "management",
      title: "Finance → direction / business partner",
      leverage: "high",
      payLift: "high",
      transferable: ["P&L", "arbitrage", "reporting", "crédibilité chiffres"],
      cvAngle: "Mettre les décisions business influencées, pas seulement les reportings produits.",
      breakChance: "Business partner d'une BU déjà couverte.",
    },
    {
      from: "finance",
      to: "tech",
      title: "Finance → FinOps / data finance / product finance",
      leverage: "high",
      payLift: "high",
      transferable: ["modèles", "SQL basique", "métriques", "gouvernance"],
      cvAngle: "Skills data réels seulement ; orienter vers automation / dashboards déjà construits.",
      breakChance: "FinOps ou analytics finance dans un groupe digitalisé.",
    },
    {
      from: "hr",
      to: "management",
      title: "RH → HRBP senior / people leader",
      leverage: "medium-high",
      payLift: "medium-high",
      transferable: ["dialogue social", "recrutement", "accompagnement managers"],
      cvAngle: "Prouver impact business du people (time-to-hire, turnover) avec chiffres réels.",
      breakChance: "HRBP d'une BU en forte croissance.",
    },
    {
      from: "ops",
      to: "management",
      title: "Ops / supply → responsable site / supply lead",
      leverage: "high",
      payLift: "medium-high",
      transferable: ["KPI", "lean", "coordination", "coûts"],
      cvAngle: "Transformer tâches en gains (€, délais, qualité) documentés.",
      breakChance: "Interim management / adjoint qui devient titulaire.",
    },
    {
      from: "healthcare",
      to: "ops",
      title: "Soignant → coordination / qualité / parcours patient",
      leverage: "medium-high",
      payLift: "medium",
      transferable: ["terrain", "protocoles", "stress", "relation patient"],
      cvAngle: "Valoriser coordination et amélioration de parcours — sans inventer un diplôme management.",
      breakChance: "Poste de cadre de santé / coordinateur sur ton service.",
    },
    {
      from: "healthcare",
      to: "education",
      title: "Soignant → formateur santé / IFSI",
      leverage: "medium",
      payLift: "medium",
      transferable: ["expertise clinique", "pédagogie informelle", "protocoles"],
      cvAngle: "Lister formations données, tutorats, transmissions — faits seulement.",
      breakChance: "Vacations formateur puis CDI organisme.",
    },
    {
      from: "education",
      to: "hr",
      title: "Enseignant → formation pro / L&D / RH",
      leverage: "medium-high",
      payLift: "medium",
      transferable: ["pédagogie", "animation", "évaluation", "gestion groupe"],
      cvAngle: "Recadrer classes comme design pédagogique + facilitation adults learners si vrai.",
      breakChance: "Formateur entreprise sur ta matière / soft skills.",
    },
    {
      from: "education",
      to: "customer",
      title: "Éducation → success / onboarding / customer education",
      leverage: "medium",
      payLift: "medium-high",
      transferable: ["expliquer", "patience", "parcours d'apprentissage"],
      cvAngle: "Insister sur capacité à faire monter en compétence — preuves concrètes.",
      breakChance: "Customer education dans un SaaS édtech ou formation.",
    },
    {
      from: "creative",
      to: "marketing",
      title: "Créatif → brand / content lead",
      leverage: "medium-high",
      payLift: "medium-high",
      transferable: ["storytelling", "identité", "production", "outils"],
      cvAngle: "Lier créations à des outcomes (engagement, conversion) si mesurés — sinon rester sur craft + collaboration.",
      breakChance: "Lead design dans une marque qui connaît déjà ton portfolio.",
    },
    {
      from: "creative",
      to: "tech",
      title: "Design → product design / UX",
      leverage: "high",
      payLift: "high",
      transferable: ["recherche user", "prototypes", "collab dev", "design system"],
      cvAngle: "Ne pas inventer de recherche utilisateur ; montrer process et livrables réels.",
      breakChance: "UX dans une product company via un projet déjà livré avec des devs.",
    },
    {
      from: "legal",
      to: "finance",
      title: "Juridique → compliance / risk / contrat commercial",
      leverage: "medium-high",
      payLift: "high",
      transferable: ["analyse risque", "négociation clauses", "réglementaire"],
      cvAngle: "Orient vers business partnering juridique avec dossiers concrets.",
      breakChance: "Compliance officer secteur régulé déjà connu.",
    },
    {
      from: "public",
      to: "ops",
      title: "Public → ops privé / project delivery",
      leverage: "medium",
      payLift: "medium-high",
      transferable: ["process", "parties prenantes", "marchés publics", "rigueur"],
      cvAngle: "Traduire procédures en pilotage de projets multi-acteurs — sans surjouer le privé.",
      breakChance: "Entreprise prestataire de ta collectivité / ministère.",
    },
    {
      from: "public",
      to: "hr",
      title: "Public → RH / formation / dialogue social",
      leverage: "medium",
      payLift: "medium",
      transferable: ["cadre réglementaire", "concertation", "gestion agents"],
      cvAngle: "Skills réglementaires + humain, preuves d'accompagnement.",
      breakChance: "RH dans un établissement public ou parapublic.",
    },
    {
      from: "hospitality",
      to: "sales",
      title: "Hôtellerie → commercial B2B / events / luxury sales",
      leverage: "medium-high",
      payLift: "medium-high",
      transferable: ["service", "upsell", "gestion stress", "relation"],
      cvAngle: "Chiffrer panier moyen, satisfaction, événements gérés.",
      breakChance: "Sales events / corporate hospitality.",
    },
    {
      from: "hospitality",
      to: "management",
      title: "Salle / cuisine → management d'établissement",
      leverage: "high",
      payLift: "medium",
      transferable: ["équipe", "qualité", "rush", "coûts matières"],
      cvAngle: "Montrer adjoint / second déjà exercé avant le titre directeur.",
      breakChance: "Reprise d'un point de vente en tant qu'adjoint puis gérant.",
    },
    {
      from: "trades",
      to: "ops",
      title: "Terrain / tech → conducteur de travaux / méthodes",
      leverage: "high",
      payLift: "medium-high",
      transferable: ["réalité chantier", "sécurité", "planning", "sous-traitants"],
      cvAngle: "Passer de « faire » à « faire faire » avec exemples de coordination réels.",
      breakChance: "Promotion interne chef d'équipe → conducteur.",
    },
    {
      from: "trades",
      to: "management",
      title: "Ouvrier qualifié → chef d'équipe / responsable atelier",
      leverage: "high",
      payLift: "medium",
      transferable: ["expertise technique", "sécurité", "transmission"],
      cvAngle: "Tutorat et organisation d'équipe déjà faits = levier honnête.",
      breakChance: "Remplacement d'un chef partant + formation courte management.",
    },
    {
      from: "marketing",
      to: "sales",
      title: "Marketing → sales / partnerships",
      leverage: "medium",
      payLift: "medium-high",
      transferable: ["ICP", "message", "leads", "positionnement"],
      cvAngle: "Si tu as touché des leads/QL, le dire ; sinon rester sur enablement sales.",
      breakChance: "Partnerships sur un canal que tu as déjà activé.",
    },
    {
      from: "marketing",
      to: "management",
      title: "Marketing → head of marketing / CMO track",
      leverage: "high",
      payLift: "high",
      transferable: ["budget campagnes", "équipe freelance", "ROI"],
      cvAngle: "Budget géré et ROI prouvés > titre fantaisie.",
      breakChance: "Lead d'un canal rentable qui devient scope multi-canaux.",
    },
    {
      from: "tech",
      to: "management",
      title: "Tech IC → engineering / team lead",
      leverage: "high",
      payLift: "high",
      transferable: ["mentorat", "architecture", "livraison", "recrutement aide"],
      cvAngle: "Mentoring et ownership transverse avant le titre EM.",
      breakChance: "Tech lead sur le domaine que tu as stabilisé.",
    },
    {
      from: "tech",
      to: "sales",
      title: "Tech → sales engineer / solutions",
      leverage: "high",
      payLift: "high",
      transferable: ["crédibilité technique", "demos", "besoins client"],
      cvAngle: "Preuves de demos, POCs, ateliers clients — pas un faux background sales.",
      breakChance: "SE sur le produit que tu as construit ou supporté.",
    },
    {
      from: "*",
      to: "management",
      title: "Expert métier → management de proximité",
      leverage: "high",
      payLift: "medium-high",
      transferable: ["crédibilité terrain", "transmission", "organisation"],
      cvAngle: "Montrer déjà de l'influence sans autorité formelle (coordination, tutorat).",
      breakChance: "Intérim sur un poste de responsable vacant.",
    },
    {
      from: "*",
      to: "finance",
      title: "Tout métier → rôle mieux payé via rareté / pénurie",
      leverage: "medium-high",
      payLift: "high",
      transferable: ["expertise rare", "certifications", "secteur en tension"],
      cvAngle: "Documenter la rareté (certifs, stack, langue, habilitation) sans inventer.",
      breakChance: "Secteur en tension (santé, data, cyber, énergie, luxe) qui surpaye ton skill.",
    },
  ];

  /**
   * Coups de chance / high-leverage breaks — universal patterns.
   */
  const BREAKS = [
    {
      id: "internal_interim",
      label: "Intérim interne / remplacement",
      why: "Tu prouves le niveau supérieur sans changer d'employeur d'abord.",
      detect: ["intérim", "remplacement", "acting", "ad interim", "transition", "faisant fonction"],
      payAccel: "medium",
    },
    {
      id: "ex_client_hire",
      label: "Embauche par un ancien client / partenaire",
      why: "Confiance déjà là — classique des sorties ESN/conseil/agence.",
      detect: ["client", "partenaire", "compte clé"],
      payAccel: "high",
    },
    {
      id: "shortage_premium",
      label: "Prime de pénurie / secteur en tension",
      why: "Le marché paie la rareté plus que le titre.",
      detect: ["pénurie", "tension", "critique", "rare", "shortage", "attractivité"],
      payAccel: "high",
    },
    {
      id: "brand_stamp",
      label: "Tampon marque (2–3 ans)",
      why: "Le nom sur le CV débloque le tour suivant.",
      detect: ["cac", "leader", "référence", "unicorn", "international"],
      payAccel: "medium-high",
    },
    {
      id: "scope_jump",
      label: "Saut de scope (budget / équipe / territoire)",
      why: "Même métier, périmètre x2 = levier comp + titre.",
      detect: ["national", "europe", "budget", "équipe de", "multi-site", "région"],
      payAccel: "high",
    },
    {
      id: "cert_gate",
      label: "Certification / habilitation portail",
      why: "Une habilitation ouvre une classe salariale supérieure.",
      detect: ["certifi", "habilitation", "agrément", "ordre", "licence", "cfa ", "aws", "pmp"],
      payAccel: "medium-high",
    },
    {
      id: "language_market",
      label: "Langue / marché international",
      why: "Accès à des grilles de paie plus hautes (remote inclus).",
      detect: ["anglais", "bilingue", "international", "remote", "emea", "luxembourg", "suisse"],
      payAccel: "high",
    },
    {
      id: "referral_sponsor",
      label: "Parrainage / sponsor interne",
      why: "Les plus gros sauts passent rarement par candidature froide seule.",
      detect: ["cooptation", "referral", "recommand"],
      payAccel: "medium",
    },
    {
      id: "reorg_vacuum",
      label: "Vide post-réorg",
      why: "Les réorganisations créent des sièges à prendre vite.",
      detect: ["réorganisation", "restructuration", "création de poste", "nouveau pôle"],
      payAccel: "medium-high",
    },
    {
      id: "regulated_jump",
      label: "Passage secteur régulé",
      why: "Banque, santé, énergie, defense paient la conformité + stabilité.",
      detect: ["bancaire", "assurance", "pharma", "énergie", "defense", "aéronautique", "nucléaire"],
      payAccel: "high",
    },
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function profileBlob(profile = {}) {
    return normalize(
      [
        profile.headline,
        profile.summary,
        profile.careerGoal,
        (profile.skills || []).join(" "),
        (profile.experiences || []).join(" "),
        profile.currentTrack,
        profile.targetTrack,
      ].join(" \n ")
    );
  }

  function detectFamilies(profile) {
    const blob = profileBlob(profile);
    const scored = FAMILIES.map((f) => ({
      ...f,
      score: f.hints.filter((h) => blob.includes(normalize(h))).length,
    }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      // Fallback from track
      const trackMap = {
        esn: "consulting",
        end_client: "ops",
        startup: "tech",
        public: "public",
      };
      const id = trackMap[profile.currentTrack] || "ops";
      const fam = FAMILIES.find((f) => f.id === id) || FAMILIES[0];
      return [{ ...fam, score: 1, inferred: true }];
    }
    return scored.slice(0, 3);
  }

  function findBridges(profile) {
    const families = detectFamilies(profile);
    const fromIds = new Set(families.map((f) => f.id));
    const out = [];

    for (const b of BRIDGES) {
      const fromOk = b.from === "*" || fromIds.has(b.from);
      if (!fromOk) continue;
      // Prefer bridges that leave current family
      const relevance = (fromIds.has(b.from) ? 2 : 0) + (b.from === "*" ? 0.5 : 0);
      out.push({
        ...b,
        fromFamily: FAMILIES.find((f) => f.id === b.from) || null,
        toFamily: FAMILIES.find((f) => f.id === b.to) || null,
        relevance,
        fromDetected: families.map((f) => f.label),
      });
    }

    out.sort((a, b) => {
      const lift = { high: 3, "medium-high": 2.5, medium: 2, low: 1 };
      return b.relevance + (lift[b.payLift] || 0) - (a.relevance + (lift[a.payLift] || 0));
    });

    return { families, bridges: out.slice(0, 12) };
  }

  function detectBreaks(job, profile) {
    const blob = normalize(
      [job?.title, job?.company, job?.description, job?.tags?.join(" "), profileBlob(profile)].join(" ")
    );
    return BREAKS.map((br) => ({
      ...br,
      hits: br.detect.filter((d) => blob.includes(normalize(d))).length,
    }))
      .filter((br) => br.hits > 0)
      .sort((a, b) => b.hits - a.hits);
  }

  /**
   * Honest CV orientation — reframes existing facts toward a target bridge.
   * Never invents employers, titles, or metrics.
   */
  function orientCv(profile, bridge) {
    const name = profile.fullName || "[Ton nom]";
    const headline = profile.headline || "Professionnel en évolution";
    const skills = profile.skills || [];
    const summary = (profile.summary || "").trim();
    const goal = profile.careerGoal || bridge?.title || "upgrade de carrière";

    const rules = [
      "Ne pas inventer d'employeur, de diplôme, de chiffre ou de titre non exercé.",
      "Traduire le vécu avec le vocabulaire de la cible (passerelle), pas fabriquer le vécu.",
      "Si une preuve manque (quota, budget, management), rester factuel ou omettre.",
      "Préférer « contribution à » / « participation » plutôt que « responsable de » si le scope n'était pas le tien.",
    ];

    const transferBlock = (bridge?.transferable || [])
      .map((t) => `• ${t} — illustrer avec une situation RÉELLE déjà vécue`)
      .join("\n");

    const orientedHeadline = bridge
      ? `${headline} → orientation ${bridge.toFamily?.label || bridge.to} (passerelle honnête)`
      : headline;

    const orientedSummary = [
      summary || `${name} — profil orienté vers : ${goal}.`,
      "",
      bridge
        ? `Passerelle visée : ${bridge.title}. Angle CV : ${bridge.cvAngle}`
        : "Passerelle : à sélectionner dans AscendOS.",
      "",
      "Compétences transférables à prouver (sans mentir) :",
      transferBlock || "• (complète tes skills LinkedIn)",
      "",
      bridge?.breakChance ? `Coup de levier typique : ${bridge.breakChance}` : "",
      "",
      "Skills : " + (skills.join(", ") || "à importer depuis LinkedIn"),
    ]
      .filter(Boolean)
      .join("\n");

    const bulletTemplates = (bridge?.transferable || []).slice(0, 5).map((t) => {
      return `• [Situation réelle] — ${t} — résultat observé : [chiffre ou fait vérifiable uniquement]`;
    });

    return {
      orientedHeadline: orientedHeadline.slice(0, 220),
      orientedSummary,
      bulletTemplates,
      rules,
      bridge,
      honestyBadge: "Sans mensonge — reframing seulement",
    };
  }

  /**
   * Suggest active career vectors from detected families + bridges (all careers).
   */
  function suggestVectorsFromProfile(profile) {
    const { families, bridges } = findBridges(profile);
    const ids = new Set([
      "seniority_climb",
      "compensation",
      "skills_capital",
      "platform_leap",
      "brand_employer",
      "scope_budget",
      "autonomy_flexibility",
    ]);

    const top = families[0]?.id;
    if (top === "consulting") {
      ids.add("esn_to_end_client");
      ids.add("product_over_agency");
      ids.add("delivery_to_strategy");
    }
    if (top === "tech") {
      ids.add("staff_ic_track");
      ids.add("ic_to_management");
      ids.add("delivery_to_strategy");
    }
    if (top === "sales" || top === "marketing") {
      ids.add("compensation");
      ids.add("scope_budget");
      ids.add("ic_to_management");
    }
    if (top === "healthcare" || top === "education" || top === "public") {
      ids.add("stability_runway");
      ids.add("mission_impact");
      ids.add("credentials_visibility");
    }
    if (top === "trades" || top === "hospitality" || top === "ops") {
      ids.add("ic_to_management");
      ids.add("scope_budget");
      ids.add("stability_runway");
    }
    if (bridges.some((b) => b.payLift === "high")) {
      ids.add("compensation");
      ids.add("geo_market");
    }

    return { families, bridges, vectorIds: [...ids] };
  }

  function scoreJobPasserelleFit(job, profile) {
    const { bridges } = findBridges(profile);
    const blob = normalize([job.title, job.company, job.description, job.tags?.join(" ")].join(" "));
    const breaks = detectBreaks(job, profile);

    let best = null;
    let bestScore = 0;
    for (const b of bridges.slice(0, 8)) {
      const toHints = b.toFamily?.hints || [];
      const hits = toHints.filter((h) => blob.includes(normalize(h))).length;
      const s = hits * 18 + (b.payLift === "high" ? 10 : b.payLift === "medium-high" ? 6 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = b;
      }
    }

    return {
      bridge: best,
      bridgeScore: Math.min(100, bestScore),
      breaks,
      breakScore: Math.min(100, breaks.reduce((a, b) => a + b.hits * 15, 0)),
    };
  }

  return {
    FAMILIES,
    BRIDGES,
    BREAKS,
    detectFamilies,
    findBridges,
    detectBreaks,
    orientCv,
    suggestVectorsFromProfile,
    scoreJobPasserelleFit,
  };
})();

window.Passerelles = Passerelles;
