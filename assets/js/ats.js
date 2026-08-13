/** ATS keyword match (Jobscan-inspired, client-side) */
const AtsEngine = (() => {
  const STOP = new Set(
    `le la les un une des de du et ou a à au aux en pour par sur avec sans dans ce cet cette ces qui que dont où il elle ils elles je tu nous vous mon ma mes ton ta tes son sa ses leur leurs est sont être avoir fait faire plus moins très comme si mais donc car ni ne pas d the a an and or of to in for on with without this that these those is are be been being have has had do does did will would can could should may might into from as at by about over under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very you your yours yourself yourselves i me my we our ours`.split(
      /\s+/
    )
  );

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9+#.\- ]+/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP.has(t));
  }

  function unique(arr) {
    return [...new Set(arr)];
  }

  function analyze(resumeText, jobText) {
    const resumeTokens = unique(tokenize(resumeText));
    const jobTokens = unique(tokenize(jobText));
    const resumeSet = new Set(resumeTokens);

    const matched = jobTokens.filter((t) => resumeSet.has(t));
    const missing = jobTokens.filter((t) => !resumeSet.has(t));

    const coverage = jobTokens.length ? matched.length / jobTokens.length : 0;
    const score = Math.round(coverage * 100);

    // Prefer longer / tech-looking missing keywords first
    const gaps = missing
      .sort((a, b) => b.length - a.length || a.localeCompare(b))
      .slice(0, 24);

    let tone = "bad";
    let label = "Sous le radar ATS";
    if (score >= 75) {
      tone = "ok";
      label = "Fort match ATS";
    } else if (score >= 55) {
      tone = "lime";
      label = "Match correct";
    } else if (score >= 35) {
      tone = "warn";
      label = "À renforcer";
    }

    return {
      score,
      label,
      tone,
      matched: matched.slice(0, 30),
      gaps,
      resumeTokenCount: resumeTokens.length,
      jobTokenCount: jobTokens.length,
    };
  }

  function suggestRewrite(summary, gaps) {
    const top = gaps.slice(0, 8);
    if (!top.length) return summary || "";
    const inject = top.join(", ");
    const base = (summary || "").trim();
    if (!base) {
      return `Profil orienté impact avec compétences clés : ${inject}.`;
    }
    return `${base.replace(/\s+$/, "")} Compétences mises en avant pour ce poste : ${inject}.`;
  }

  return { analyze, suggestRewrite, tokenize };
})();

window.AtsEngine = AtsEngine;
