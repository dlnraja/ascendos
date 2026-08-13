/**
 * CoverLetter — local honest pitch per offer (no invented facts).
 * Crosses profile, LinkedIn/vault snippets, work prefs, apply memory.
 */
const CoverLetter = (() => {
  function vaultBits(profile = {}) {
    return (profile.aiImports || [])
      .slice(0, 2)
      .map((x) => (typeof x === "string" ? x : x?.text || x?.body || ""))
      .filter(Boolean)
      .map((t) => String(t).trim().slice(0, 220));
  }

  function generate({ profile, job, bridge = null, atsGaps = [], memory = [] }) {
    const name = profile.fullName || "Candidat";
    const role = job?.title || "le poste";
    const company = job?.company || "votre équipe";
    const skills = (profile.skills || []).slice(0, 6).join(", ") || "mon parcours";
    const goal = profile.careerGoal || "un rôle à plus fort levier";
    const work =
      typeof WorkPrefs !== "undefined" ? WorkPrefs.summaryText(profile) : profile.location || "";
    const bridgeLine = bridge?.title
      ? `Cette candidature s’inscrit dans une trajectoire claire : ${bridge.title}.`
      : `Je cible des rôles qui augmentent ownership, impact et progression — pas seulement un titre.`;
    const gapLine =
      atsGaps.length > 0
        ? `J’ai noté l’importance de ${atsGaps.slice(0, 3).join(", ")} dans l’offre ; je peux détailler mes preuves concrètes sur ces points en entretien — sans sur-promettre.`
        : `Je peux illustrer chaque exigence clé de l’offre avec des preuves déjà présentes dans mon parcours.`;

    const memHints =
      typeof ApplyMemory !== "undefined" ? ApplyMemory.summaryHints(memory) : [];
    const memBlock = memHints.length
      ? `\n${memHints.map((h) => h).join("\n")}\n`
      : "";

    const vault = vaultBits(profile);
    const vaultLine = vault[0]
      ? `\nÉléments déjà documentés dans mon dossier : ${vault[0]}\n`
      : "";

    const summary = String(profile.summary || "").trim().slice(0, 420);

    const subject = `${role} — ${name}`;
    const body = `Bonjour,

Je vous contacte au sujet de « ${role} » chez ${company}.

${bridgeLine}
En synthèse : ${profile.headline || "professionnel·le motivé·e"}.
Forces mobilisables immédiatement : ${skills}.
${work ? `Disponibilité / mode de travail : ${work}.\n` : ""}${summary ? `\n${summary}\n` : ""}${vaultLine}${gapLine}
${memBlock}
Objectif : ${goal}.

Je serais ravi·e d’échanger 15 minutes pour vérifier l’adéquation — sans inventer ce que je n’ai pas fait.

Bien cordialement,
${name}
${profile.email || ""}
${profile.linkedinUrl || ""}`;

    return {
      id: `cover_${Date.now().toString(36)}`,
      subject,
      body: body.replace(/\n{3,}/g, "\n\n").trim(),
      jobId: job?.id || null,
      at: Date.now(),
      honest: true,
    };
  }

  return { generate };
})();

window.CoverLetter = CoverLetter;
