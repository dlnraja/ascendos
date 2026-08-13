/**
 * ApplyMemory — learn from candidature outcomes, emails, returns (local only).
 * Feeds CV / cover generation without inventing facts.
 */
const ApplyMemory = (() => {
  function ensure(state) {
    if (!state.applyMemory) state.applyMemory = [];
    return state.applyMemory;
  }

  function add(state, entry) {
    const list = ensure(state);
    const row = {
      id: `mem_${Date.now().toString(36)}`,
      at: Date.now(),
      jobId: entry.jobId || null,
      company: entry.company || "",
      role: entry.role || "",
      outcome: entry.outcome || "note", // sent | reply | interview | offer | reject | ghost | note
      channel: entry.channel || "other", // email | linkedin | ats | call | other
      note: String(entry.note || "").trim(),
      lesson: String(entry.lesson || "").trim(),
      emailSnippet: String(entry.emailSnippet || "").trim().slice(0, 2000),
    };
    list.unshift(row);
    state.applyMemory = list.slice(0, 200);
    return row;
  }

  function forJob(state, jobId) {
    return ensure(state).filter((m) => m.jobId === jobId);
  }

  function lessonsRelevant(state, job = {}) {
    const all = ensure(state);
    if (!job) return all.slice(0, 8);
    const blob = `${job.title || ""} ${job.company || ""} ${job.description || ""}`.toLowerCase();
    return [...all]
      .map((m) => {
        let score = 0;
        if (m.company && blob.includes(String(m.company).toLowerCase())) score += 3;
        if (m.role && blob.includes(String(m.role).toLowerCase().slice(0, 12))) score += 2;
        if (m.outcome === "reject") score += 1;
        if (m.outcome === "interview" || m.outcome === "offer") score += 2;
        if (m.lesson) score += 1;
        return { ...m, score };
      })
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, 10);
  }

  function summaryHints(memory = []) {
    const rejects = memory.filter((m) => m.outcome === "reject");
    const wins = memory.filter((m) => m.outcome === "interview" || m.outcome === "offer");
    const lines = [];
    if (wins.length) {
      lines.push(
        `Ce qui a fonctionné : ${wins
          .slice(0, 2)
          .map((w) => w.lesson || w.note || w.role)
          .filter(Boolean)
          .join(" · ")}`
      );
    }
    if (rejects.length) {
      lines.push(
        `Points de vigilance (retours) : ${rejects
          .slice(0, 2)
          .map((w) => w.lesson || w.note)
          .filter(Boolean)
          .join(" · ")}`
      );
    }
    return lines;
  }

  return { ensure, add, forJob, lessonsRelevant, summaryHints };
})();

window.ApplyMemory = ApplyMemory;
