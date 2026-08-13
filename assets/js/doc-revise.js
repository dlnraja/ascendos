/**
 * DocRevise — natural-language corrections on CV / cover letters.
 * Rule-based, local, no invention of new employers or metrics.
 */
const DocRevise = (() => {
  function detectInconsistencies(text, profile = {}) {
    const issues = [];
    const t = String(text || "");
    const name = profile.fullName || "";
    if (name && !t.toLowerCase().includes(name.split(" ")[0]?.toLowerCase() || "")) {
      issues.push({ id: "name", level: "warn", msg: "Le nom du profil n’apparaît pas clairement dans le document." });
    }
    const fakeMetrics = t.match(/\b(\d{2,3})\s*%\s*(d['’]augmentation|de croissance|ROI|ARR)\b/gi);
    if (fakeMetrics?.length) {
      issues.push({
        id: "metrics",
        level: "warn",
        msg: `Chiffres sensibles détectés (${fakeMetrics.slice(0, 2).join(", ")}) — vérifie qu’ils sont réels.`,
      });
    }
    if (/expert\s+incontournable|meilleur\s+du\s+marché|n°\s*1\s+mondial/i.test(t)) {
      issues.push({ id: "hype", level: "bad", msg: "Formulation excessive — à adoucir (honnêteté)." });
    }
    const skills = profile.skills || [];
    for (const sk of skills.slice(0, 20)) {
      /* no-op scan reserved */
    }
    if (t.length < 120) {
      issues.push({ id: "short", level: "warn", msg: "Document très court — complète avant envoi." });
    }
    return issues;
  }

  /**
   * Apply a French/English NL instruction to document text.
   */
  function applyInstruction(text, instruction, profile = {}) {
    let out = String(text || "");
    const cmd = String(instruction || "").trim();
    const notes = [];
    if (!cmd) return { text: out, notes: ["Instruction vide"], issues: detectInconsistencies(out, profile) };

    const lower = cmd.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

    // Remove / drop phrases
    let m = cmd.match(/(?:retire|supprime|enl[eè]ve|remove|delete)\s+[:«"]?\s*(.+)$/i);
    if (m) {
      const target = m[1].replace(/[»"]/g, "").trim();
      if (target && out.toLowerCase().includes(target.toLowerCase())) {
        out = out.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
        notes.push(`Retiré : « ${target.slice(0, 80)} »`);
      } else {
        notes.push(`Introuvable à retirer : « ${target.slice(0, 60)} »`);
      }
    }

    // Replace A by B
    m = cmd.match(/(?:remplace|replace)\s+(.+?)\s+(?:par|by|avec)\s+(.+)$/i);
    if (m) {
      const a = m[1].replace(/^["«]|["»]$/g, "").trim();
      const b = m[2].replace(/^["«]|["»]$/g, "").trim();
      if (a) {
        out = out.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), b);
        notes.push(`Remplacé « ${a.slice(0, 40)} » → « ${b.slice(0, 40)} »`);
      }
    }

    // Shorten
    if (/raccourci|plus court|shorten|condense|r[eé]sume/i.test(lower)) {
      const paras = out.split(/\n{2,}/);
      out = paras
        .map((p) => {
          if (p.length > 420) return p.slice(0, 400).replace(/\s+\S*$/, "") + "…";
          return p;
        })
        .join("\n\n");
      notes.push("Paragraphes longs condensés.");
    }

    // Less commercial / softer
    if (/moins\s+commercial|moins\s+hype|plus\s+factuel|adouci|ton\s+neutre/i.test(lower)) {
      out = out
        .replace(/passionn[ée]ment/gi, "avec sérieux")
        .replace(/expert incontournable/gi, "professionnel expérimenté")
        .replace(/n°\s*1/gi, "référent")
        .replace(/révolutionnaire/gi, "structurant")
        .replace(/disruptif/gi, "innovant");
      notes.push("Ton adouci (formulations trop marketing réduites).");
    }

    // Add skill if present in profile
    m = cmd.match(/(?:ajoute|ajoute?\s+la\s+comp[eé]tence|add)\s+[:«"]?\s*(.+)$/i);
    if (m && !notes.some((n) => n.startsWith("Retiré") || n.startsWith("Remplacé"))) {
      const want = m[1].replace(/[»"]/g, "").trim();
      const known = (profile.skills || []).some((s) => s.toLowerCase() === want.toLowerCase());
      if (known || /linkedin|vault|profil/i.test(want)) {
        if (!out.toLowerCase().includes(want.toLowerCase())) {
          out = out.replace(/(COMP[EÉ]TENCES[^\n]*\n)/i, `$1${want} · `);
          if (!/COMP[EÉ]TENCES/i.test(out)) out += `\n\nCOMPÉTENCES\n${want}`;
          notes.push(known ? `Compétence ajoutée (présente au profil) : ${want}` : `Mention ajoutée : ${want}`);
        }
      } else {
        notes.push(
          `Refus d’inventer « ${want} » — absente du profil. Ajoute-la d’abord dans Profil si c’est vrai.`
        );
      }
    }

    // Emphasize location / remote
    if (/insiste\s+sur\s+(remote|hybride|pr[eé]sentiel|t[eé]l[eé]travail)/i.test(lower)) {
      const mm = lower.match(/insiste\s+sur\s+(remote|hybride|presentiel|teletravail)/);
      const label = mm?.[1] || "mobilité";
      if (!out.toLowerCase().includes(label)) {
        out = `Mobilité souhaitée : ${label}\n\n` + out;
        notes.push(`Mention mobilité ajoutée : ${label}`);
      }
    }

    // Fix typos light
    if (/corrige|orthographe|fix\s+typo/i.test(lower)) {
      out = out
        .replace(/\bje suis interess[eé]\b/gi, "je suis intéressé")
        .replace(/\bentreprise\s+startup\b/gi, "startup")
        .replace(/  +/g, " ");
      notes.push("Corrections orthographe légères appliquées.");
    }

    out = out.replace(/\n{3,}/g, "\n\n").trim();
    if (!notes.length) {
      notes.push(
        "Instruction non reconnue précisément. Exemples : « retire … », « remplace A par B », « raccourcis », « moins commercial », « ajoute Python » (si dans le profil)."
      );
    }

    return {
      text: out,
      notes,
      issues: detectInconsistencies(out, profile),
    };
  }

  return { applyInstruction, detectInconsistencies };
})();

window.DocRevise = DocRevise;
