/**
 * InterviewPrep — local question + STAR story packs from job + profile.
 */
const InterviewPrep = (() => {
  const BASE_Q = [
    "Parcours : pourquoi ce rôle maintenant ?",
    "Preuve d’impact chiffré sur 12–18 mois",
    "Gestion d’un désaccord stakeholder",
    "Apprentissage rapide sur un sujet nouveau",
    "Pourquoi cette entreprise / ce contexte ?",
  ];

  function generate({ profile, job, vectors = [] }) {
    const role = job?.title || "le poste";
    const company = job?.company || "l’entreprise";
    const desc = String(job?.description || "").toLowerCase();
    const skills = profile?.skills || [];
    const questions = [...BASE_Q];

    if (/lead|manager|équipe|encadrement/.test(desc) || /lead|manager/i.test(role)) {
      questions.push("Management : un moment où tu as fait monter quelqu’un");
      questions.push("Priorisation : comment tu arbitres charge vs qualité");
    }
    if (/produit|product|roadmap|utilisateur/.test(desc)) {
      questions.push("Produit : une décision trade-off users vs deadline");
    }
    if (/data|sql|dashboard|kpi/.test(desc)) {
      questions.push("Data : un KPI que tu as fait bouger — comment ?");
    }
    if (/client|commercial|sales|quota/.test(desc)) {
      questions.push("Commercial : une objection difficile et ta réplique");
    }

    const stories = (skills.slice(0, 4).length ? skills.slice(0, 4) : ["livraison", "collaboration", "analyse"]).map(
      (sk) => ({
        skill: sk,
        prompt: `STAR · ${sk}`,
        situation: `Contexte lié à ${sk} (équipe, contrainte, enjeu).`,
        task: `Ta responsabilité précise — sans inventer un titre.`,
        action: `2–3 actions concrètes que TU as faites.`,
        result: `Résultat mesurable (temps, €, qualité, NPS…) si tu l’as.`,
      })
    );

    const vectorTips = (vectors || [])
      .slice(0, 3)
      .map((id) => {
        const v = typeof CareerVectors !== "undefined" ? CareerVectors.byId(id) : null;
        return v ? `Ancre ta réponse sur « ${v.short || v.label} »` : null;
      })
      .filter(Boolean);

    return {
      jobId: job?.id || null,
      role,
      company,
      questions: [...new Set(questions)].slice(0, 10),
      stories,
      vectorTips,
      closer: `Question à poser : « À 6 mois, à quoi ressemble le succès sur ${role} chez ${company} ? »`,
      at: Date.now(),
    };
  }

  return { generate };
})();

window.InterviewPrep = InterviewPrep;
