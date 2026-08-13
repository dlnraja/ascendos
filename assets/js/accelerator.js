/**
 * Career Accelerator — scores jobs for career leverage
 * (ESN / body-shopping → end-client / product / ownership).
 */
const CareerAccelerator = (() => {
  const ESN_HINTS = [
    "esn",
    "ssii",
    "cabinet de conseil",
    "consulting firm",
    "staffing",
    "body shopping",
    "prestataire",
    "mission chez client",
    "tjm",
    "régie",
    "assistance technique",
    "it services",
    "digital services",
  ];

  const END_CLIENT_HINTS = [
    "client final",
    "end client",
    "in-house",
    "interne",
    "product owner",
    "product manager",
    "équipe produit",
    "scale-up",
    "cac 40",
    "grand groupe",
    "banque",
    "assurance",
    "industrie",
    "aéronautique",
    "luxe",
    "retail",
    "énergie",
    "téléc",
    "éditeur",
    "saas",
    "scaleup",
  ];

  const CLIMB_HINTS = [
    "lead",
    "senior",
    "principal",
    "staff",
    "manager",
    "head of",
    "architect",
    "tech lead",
    "engineering manager",
    "responsable",
    "chef de projet",
    "directeur",
  ];

  const REWARD_HINTS = [
    "remote",
    "télétravail",
    "intéressement",
    "participation",
    "bspce",
    "stock options",
    "rtt",
    "package",
    "impact",
    "ownership",
    "roadmap",
    "budget",
    "équipe de",
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function countHits(hay, needles) {
    return needles.filter((n) => hay.includes(normalize(n))).length;
  }

  /**
   * @param {object} job
   * @param {object} profile
   */
  function scoreJob(job, profile = {}) {
    const blob = normalize(
      [job.title, job.company, job.description, job.tags?.join(" "), job.employerType].join(" \n ")
    );

    const esnHits = countHits(blob, ESN_HINTS);
    const endHits = countHits(blob, END_CLIENT_HINTS);
    const climbHits = countHits(blob, CLIMB_HINTS);
    const rewardHits = countHits(blob, REWARD_HINTS);

    let employerType = job.employerType || "unknown";
    if (employerType === "unknown") {
      if (endHits > esnHits) employerType = "end_client";
      else if (esnHits > 0) employerType = "esn";
      else employerType = "unclear";
    }

    // Base: end-client preferred for ESN escape velocity
    let score = 40;
    const reasons = [];

    if (employerType === "end_client") {
      score += 28;
      reasons.push("Employeur orienté client final / interne — fort levier vs ESN.");
    } else if (employerType === "esn") {
      score -= 18;
      reasons.push("Signal ESN / prestation — utile en transition, faible accélération long terme.");
    } else {
      score += 4;
      reasons.push("Type d'employeur ambigu — vérifier si le poste est internalisé.");
    }

    if (climbHits > 0) {
      score += Math.min(18, climbHits * 6);
      reasons.push("Titre / scope avec montée en séniorité (lead, senior, manager…).");
    }

    if (rewardHits > 0) {
      score += Math.min(12, rewardHits * 3);
      reasons.push("Indices de gratification (ownership, package, remote, impact).");
    }

    // Skill overlap light boost
    const skills = (profile.skills || []).map((s) => normalize(s));
    const skillHits = skills.filter((s) => s && blob.includes(s)).length;
    if (skillHits > 0) {
      score += Math.min(14, skillHits * 2);
      reasons.push(`${skillHits} compétence(s) du profil présentes dans l'offre.`);
    }

    // Penalize pure lateral ESN→ESN when user wants end_client
    if (profile.targetTrack === "end_client" && employerType === "esn") {
      score -= 10;
      reasons.push("Écart avec ton objectif « grands groupes / clients finaux ».");
    }

    if (profile.targetTrack === "end_client" && employerType === "end_client") {
      score += 8;
      reasons.push("Aligné avec ton objectif de trajectoire client final.");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let label = "Neutre";
    let tone = "warn";
    if (score >= 75) {
      label = "Accélérateur fort";
      tone = "ok";
    } else if (score >= 60) {
      label = "Bon levier";
      tone = "lime";
    } else if (score >= 40) {
      label = "Transition possible";
      tone = "warn";
    } else {
      label = "Faible levier";
      tone = "bad";
    }

    return {
      score,
      label,
      tone,
      employerType,
      reasons,
      signals: { esnHits, endHits, climbHits, rewardHits, skillHits },
    };
  }

  function rankJobs(jobs, profile) {
    return [...jobs]
      .map((j) => ({ ...j, accelerator: scoreJob(j, profile) }))
      .sort((a, b) => b.accelerator.score - a.accelerator.score);
  }

  return { scoreJob, rankJobs, ESN_HINTS, END_CLIENT_HINTS };
})();

window.CareerAccelerator = CareerAccelerator;
