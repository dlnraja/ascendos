/** Import parsers: LinkedIn paste, Gemini/AI JSON or prose, CV text */
const ProfileImporter = (() => {
  function tryParseJson(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    try {
      if (t.startsWith("{") || t.startsWith("[")) return JSON.parse(t);
    } catch {
      /* try fenced */
    }
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }

  function fromAiPayload(raw) {
    const json = tryParseJson(raw);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return {
        source: "ai_json",
        patch: {
          fullName: json.fullName || json.name || json.full_name || "",
          headline: json.headline || json.title || "",
          summary: json.summary || json.about || json.profile || "",
          email: json.email || "",
          location: json.location || "",
          skills: arr(json.skills),
          experiences: arr(json.experiences || json.experience),
          languages: arr(json.languages).length ? arr(json.languages) : undefined,
          careerGoal: json.career_goal || json.careerGoal || json.objective || "",
          target_roles: arr(json.target_roles || json.targetRoles),
        },
      };
    }

    // Free text from Gemini / ChatGPT
    const lines = String(raw || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const skillsLine = lines.find((l) => /compétences|skills/i.test(l));
    const skills = skillsLine
      ? skillsLine
          .split(/:|：/)
          .slice(1)
          .join(":")
          .split(/[,;|/•]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 1)
      : [];

    const headline =
      lines.find((l) => /headline|titre|poste/i.test(l))?.replace(/^[^:：]+[:：]\s*/, "") ||
      lines[0] ||
      "";

    const summary = lines.slice(0, 12).join("\n");

    return {
      source: "ai_text",
      patch: {
        headline: headline.slice(0, 180),
        summary,
        skills,
      },
    };
  }

  function fromLinkedInPaste(raw) {
    const text = String(raw || "");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const fullName = lines[0] || "";
    const headline = lines[1] || "";
    const aboutIdx = lines.findIndex((l) => /^à propos|^about$/i.test(l));
    const summary =
      aboutIdx >= 0 ? lines.slice(aboutIdx + 1, aboutIdx + 8).join(" ") : lines.slice(2, 6).join(" ");

    const skillBlock = text.match(/(?:compétences|skills)\s*([\s\S]{0,800})/i);
    const skills = skillBlock
      ? skillBlock[1]
          .split(/\n|•|,|;/)
          .map((s) => s.trim())
          .filter((s) => s.length > 1 && s.length < 40)
          .slice(0, 40)
      : [];

    return {
      source: "linkedin_paste",
      patch: { fullName, headline, summary, skills },
    };
  }

  function arr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.title || x?.name || JSON.stringify(x)));
    if (typeof v === "string") return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function applyPatch(profile, patch) {
    const next = { ...profile };
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (k === "target_roles") continue;
      next[k] = v;
    }
    return next;
  }

  /** Paste import is the local source of truth — no API / OAuth required. */
  const NOTICE = "Import collé = source locale (pas d’API requise).";

  return { fromAiPayload, fromLinkedInPaste, applyPatch, tryParseJson, NOTICE };
})();

window.ProfileImporter = ProfileImporter;
