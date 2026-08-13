/**
 * One-click workflows — orchestrate via AscendCore facade (local → upgrade → degrade).
 */
const AscendWorkflows = (() => {
  const WORKFLOWS = [
    {
      id: "morning_sprint",
      label: "Sprint matin",
      blurb: "Vecteurs → offres (AscendCore) → file PRIME → readiness + AutoFill.",
      oneButton: "Lancer le sprint",
      path: "local",
      steps: ["vectors", "fresh", "queue_prime", "cover_top", "readiness_top", "autofill_top", "summary"],
    },
    {
      id: "apply_prime",
      label: "Postuler PRIME",
      blurb: "Classe frais × levier via la façade, file en tête, score Ready.",
      oneButton: "File PRIME maintenant",
      path: "local",
      steps: ["fresh_rank", "queue_prime", "readiness_top", "summary"],
    },
    {
      id: "candidature_pack",
      label: "Pack candidature",
      blurb: "CV + lettre (docs.*) + interview + AutoFill + Email Finder (0 clé).",
      oneButton: "Préparer le pack",
      path: "local",
      steps: ["best_job", "cv_orient", "cover_top", "interview_top", "autofill_top", "email_hint", "readiness_top", "summary"],
    },
    {
      id: "profile_boost",
      label: "Boost profil",
      blurb: "Passerelles + vecteurs + LinkedIn — 100 % local.",
      oneButton: "Optimiser mon cap",
      path: "local",
      steps: ["vectors", "passerelles", "linkedin", "summary"],
    },
    {
      id: "batch_loop",
      label: "Batch / Loop Apply",
      blurb: "Gaps → packs → onglets. Outreach préparé ; envoi Gmail = confirm UI seulement.",
      oneButton: "Lancer batch file",
      path: "local",
      steps: ["queue_prime", "cover_top", "readiness_top", "batch_prepare", "summary"],
    },
  ];

  function byId(id) {
    return WORKFLOWS.find((w) => w.id === id);
  }

  /** Path label for UI chips */
  function pathChip(wf) {
    const p = wf?.path || "local";
    if (typeof AscendCore !== "undefined" && AscendCore.pathMeta) {
      return AscendCore.pathMeta(p);
    }
    return { label: p, path: p, tone: "ok" };
  }

  return { WORKFLOWS, byId, pathChip };
})();

window.AscendWorkflows = AscendWorkflows;
