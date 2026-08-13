/**
 * One-click workflows — orchestrate AscendOS without UI clutter.
 */
const AscendWorkflows = (() => {
  const WORKFLOWS = [
    {
      id: "morning_sprint",
      label: "Sprint matin",
      blurb: "Vecteurs → offres fraîches → file PRIME → readiness + AutoFill du top.",
      oneButton: "Lancer le sprint",
      steps: ["vectors", "fresh", "queue_prime", "cover_top", "readiness_top", "autofill_top", "summary"],
    },
    {
      id: "apply_prime",
      label: "Postuler PRIME",
      blurb: "Classe frais × levier, file en tête, score de préparation.",
      oneButton: "File PRIME maintenant",
      steps: ["fresh_rank", "queue_prime", "readiness_top", "summary"],
    },
    {
      id: "candidature_pack",
      label: "Pack candidature",
      blurb: "CV orienté + lettre + interview pack + AutoFill + Email Finder.",
      oneButton: "Préparer le pack",
      steps: ["best_job", "cv_orient", "cover_top", "interview_top", "autofill_top", "email_hint", "readiness_top", "summary"],
    },
    {
      id: "profile_boost",
      label: "Boost profil",
      blurb: "Passerelles + vecteurs + LinkedIn prêts à coller.",
      oneButton: "Optimiser mon cap",
      steps: ["vectors", "passerelles", "linkedin", "summary"],
    },
    {
      id: "batch_loop",
      label: "Batch / Loop Apply",
      blurb: "Complète les gaps → packs AutoFill → ouvre les onglets RH en série.",
      oneButton: "Lancer batch file",
      steps: ["queue_prime", "cover_top", "readiness_top", "batch_prepare", "summary"],
    },
  ];

  function byId(id) {
    return WORKFLOWS.find((w) => w.id === id);
  }

  return { WORKFLOWS, byId };
})();

window.AscendWorkflows = AscendWorkflows;
