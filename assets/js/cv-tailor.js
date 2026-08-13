/**
 * CvTailor — personalized CV per offer from crossed local facts only.
 * Never invents employers, dates, diplomas, or metrics.
 */
const CvTailor = (() => {
  function factsFromProfile(profile = {}) {
    const aiBits = (profile.aiImports || [])
      .slice(0, 3)
      .map((x) => (typeof x === "string" ? x : x?.text || x?.body || ""))
      .filter(Boolean);
    return {
      name: profile.fullName || "",
      headline: profile.headline || "",
      email: profile.email || "",
      phone: profile.phone || "",
      location: profile.location || "",
      linkedin: profile.linkedinUrl || "",
      website: profile.website || "",
      summary: String(profile.summary || "").trim(),
      skills: [...(profile.skills || [])],
      education: [...(profile.education || [])],
      experiences: [...(profile.experiences || [])],
      languages: [...(profile.languages || [])],
      goal: profile.careerGoal || "",
      work: typeof WorkPrefs !== "undefined" ? WorkPrefs.summaryText(profile) : "",
      vaultSnippets: aiBits.map((t) => String(t).slice(0, 600)),
    };
  }

  function tokenize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9+#.]/i)
      .filter((w) => w.length > 2);
  }

  function overlapSkills(skills, jobBlob) {
    const blob = tokenize(jobBlob).join(" ");
    const hit = [];
    const soft = [];
    for (const sk of skills) {
      const n = String(sk || "").trim();
      if (!n) continue;
      if (blob.includes(tokenize(n).join(" ")) || blob.includes(n.toLowerCase())) hit.push(n);
      else soft.push(n);
    }
    return { hit, soft };
  }

  function pickRelevantExperience(experiences, jobBlob, limit = 5) {
    const tokens = new Set(tokenize(jobBlob));
    return [...experiences]
      .map((ex) => {
        const text = typeof ex === "string" ? ex : [ex.title, ex.company, ex.bullets?.join(" "), ex.description].filter(Boolean).join(" ");
        const words = tokenize(text);
        const score = words.filter((w) => tokens.has(w)).length;
        return { text: String(text).trim(), score };
      })
      .filter((x) => x.text)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function lessonsFromMemory(memory = [], job = {}) {
    if (!memory?.length) return [];
    const blob = tokenize([job.title, job.company, job.description].join(" ")).join(" ");
    return memory
      .filter((m) => m.lesson || m.note)
      .map((m) => {
        const t = tokenize([m.company, m.role, m.lesson, m.note].join(" ")).join(" ");
        const score = t.split(" ").filter((w) => w && blob.includes(w)).length;
        return { ...m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  function honestyNotes(facts, job, skillHit) {
    const notes = [
      "Aucune expérience, diplôme ou chiffre n’a été inventé.",
      "Seuls les faits du profil, imports AI Vault, formations et retours candidatures ont été croisés.",
    ];
    if (!facts.experiences.length && !facts.summary) {
      notes.push("Profil mince : complète expériences / résumé avant d’envoyer.");
    }
    if (skillHit.soft.length && skillHit.hit.length < 3) {
      notes.push(
        `Mots de l’offre non prouvés dans ton profil (ne pas forcer) : ${skillHit.soft.slice(0, 8).join(", ")}`
      );
    }
    return notes;
  }

  /**
   * @returns {{ body: string, html: string, meta: object, honesty: string[] }}
   */
  function generate({ profile, job, bridge = null, atsGaps = [], memory = [] }) {
    const facts = factsFromProfile(profile);
    const jobBlob = [job?.title, job?.company, job?.description, job?.location, job?.tags?.join(" ")].join("\n");
    const skills = overlapSkills(facts.skills, jobBlob);
    const ex = pickRelevantExperience(facts.experiences, jobBlob);
    const lessons = lessonsFromMemory(memory, job || {});
    const target = job?.title || "Poste cible";
    const company = job?.company || "";

    const headline = [
      facts.headline || facts.name || "Professionnel·le",
      target && company ? `→ ${target} @ ${company}` : target ? `→ ${target}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const bridgeLine = bridge?.cvAngle || bridge?.title
      ? `Angle trajectoire (sans invention) : ${bridge.cvAngle || bridge.title}`
      : "";

    const summaryBits = [facts.summary];
    if (facts.vaultSnippets[0]) {
      summaryBits.push(`Extraits dossier (vault) : ${facts.vaultSnippets[0].slice(0, 280)}`);
    }
    const summary = summaryBits.filter(Boolean).join("\n\n").slice(0, 900);

    const skillLine = skills.hit.length
      ? skills.hit.slice(0, 12).join(" · ")
      : facts.skills.slice(0, 10).join(" · ");

    const atsLine =
      atsGaps?.length > 0
        ? `Points de l’offre à couvrir en entretien UNIQUEMENT si vrais : ${atsGaps.slice(0, 6).join(", ")}`
        : "";

    const lessonLines = lessons.map(
      (l) =>
        `- Retour passé (${l.outcome || "note"}) : ${String(l.lesson || l.note).slice(0, 160)}`
    );

    const edu = facts.education.length ? facts.education.map((e) => `- ${e}`).join("\n") : "- (à compléter)";
    const expBlock = ex.length
      ? ex.map((e) => `- ${e.text}`).join("\n")
      : facts.experiences.length
        ? facts.experiences.slice(0, 5).map((e) => `- ${typeof e === "string" ? e : e.title || JSON.stringify(e)}`).join("\n")
        : "- (ajoute des expériences dans le profil — rien n’a été inventé)";

    const body = [
      facts.name,
      headline,
      [facts.email, facts.phone, facts.location, facts.linkedin, facts.website].filter(Boolean).join(" · "),
      facts.work ? `Mobilité / mode : ${facts.work}` : "",
      "",
      "PROFIL",
      summary || "(Complète ton résumé profil — pas de filler inventé.)",
      bridgeLine,
      "",
      "COMPÉTENCES ALIGNÉES OFFRE",
      skillLine || "(Aucune compétence profil matchée — enrichis le profil.)",
      atsLine,
      "",
      "EXPÉRIENCES (sélection pertinente)",
      expBlock,
      "",
      "FORMATIONIONS",
      edu,
      facts.languages.length ? `\nLANGUES\n${facts.languages.join(" · ")}` : "",
      lessonLines.length ? `\nLEÇONS CANDIDATURES (mémoire locale)\n${lessonLines.join("\n")}` : "",
      facts.goal ? `\nOBJECTIF\n${facts.goal}` : "",
      "",
      "— Généré par AscendOS · faits locaux uniquement —",
    ]
      .filter((l) => l != null)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");

    const honesty = honestyNotes(facts, job, skills);
    const html = toPrintHtml({ facts, headline, summary, skillLine, expBlock, edu, company, target, work: facts.work });

    return {
      id: `cv_${Date.now().toString(36)}`,
      name: `CV · ${target}${company ? ` · ${company}` : ""}`,
      target: `${target}${company ? ` @ ${company}` : ""}`,
      jobId: job?.id || null,
      body,
      html,
      at: Date.now(),
      honest: true,
      honesty,
      meta: {
        skillHits: skills.hit,
        skillSoft: skills.soft.slice(0, 12),
        lessonsUsed: lessons.length,
      },
    };
  }

  function toPrintHtml({ facts, headline, summary, skillLine, expBlock, edu, company, target, work }) {
    const esc = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const pre = (s) => esc(s).replace(/\n/g, "<br/>");
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<title>CV — ${esc(facts.name)}</title>
<style>
@page{margin:18mm}
body{font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;line-height:1.35;max-width:720px;margin:0 auto;padding:24px}
h1{font-size:22pt;margin:0 0 4px;font-weight:700}
h2{font-size:11pt;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #222;margin:18px 0 8px;padding-bottom:3px}
.meta{font-size:9.5pt;color:#444}
.sub{font-size:11pt;margin:0 0 12px;color:#222}
.block{font-size:10.5pt;white-space:pre-wrap}
</style></head><body>
<h1>${esc(facts.name || "CV")}</h1>
<p class="sub">${esc(headline)}</p>
<p class="meta">${esc([facts.email, facts.phone, facts.location, facts.linkedin].filter(Boolean).join(" · "))}</p>
${work ? `<p class="meta">${esc(work)}</p>` : ""}
${target ? `<p class="meta">Cible : ${esc(target)}${company ? ` · ${esc(company)}` : ""}</p>` : ""}
<h2>Profil</h2><div class="block">${pre(summary)}</div>
<h2>Compétences</h2><div class="block">${pre(skillLine)}</div>
<h2>Expériences</h2><div class="block">${pre(expBlock)}</div>
<h2>Formations</h2><div class="block">${pre(edu)}</div>
</body></html>`;
  }

  function openPrint(html) {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) throw new Error("Popup bloquée — autorise les fenêtres pour PDF / impression");
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* user prints manually */
      }
    }, 250);
  }

  return { generate, factsFromProfile, openPrint, toPrintHtml };
})();

window.CvTailor = CvTailor;
