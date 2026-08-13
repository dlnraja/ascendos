/**
 * ApplyReadiness — per-job checklist + score before you hit send.
 * Coherent gate across ATS, career leverage, freshness, pack, outreach.
 */
const ApplyReadiness = (() => {
  function score(job, profile, ctx = {}) {
    const items = [];
    const career = ctx.careerScore ?? (typeof CareerAccelerator !== "undefined"
      ? CareerAccelerator.scoreJob(job, profile).score
      : 50);
    const ats = ctx.atsScore ?? job.atsScore ?? null;
    const fresh = ctx.fresh ?? (typeof FreshRadar !== "undefined"
      ? FreshRadar.freshnessScore(job)
      : null);
    const comp = ctx.comp ?? (typeof CompSignal !== "undefined"
      ? CompSignal.enrichJob(job, profile)
      : null);
    const hasCover = Boolean(ctx.hasCover ?? job.coverLetter);
    const hasContact = Boolean(ctx.hasContact);
    const hasCv = Boolean(ctx.hasCv ?? (profile?.summary && profile.summary.length > 40));
    const autofillReady = Boolean(ctx.autofillReady ?? job.autofillReady);

    items.push({
      id: "profile",
      label: "Profil exploitable",
      ok: hasCv,
      weight: 12,
      hint: hasCv ? "OK" : "Complète résumé / skills",
    });
    items.push({
      id: "career",
      label: "Levier carrière",
      ok: career >= 55,
      weight: 18,
      hint: `Score ${career}`,
      score: career,
    });
    items.push({
      id: "ats",
      label: "Match mots-clés",
      ok: ats == null ? false : ats >= 55,
      weight: 18,
      hint: ats == null ? "Lance le match" : `ATS ${ats}%`,
      score: ats,
    });
    items.push({
      id: "fresh",
      label: "Fraîcheur",
      ok: fresh ? fresh.tier?.id === "prime" || fresh.tier?.id === "hot" || fresh.score >= 55 : false,
      weight: 14,
      hint: fresh?.ageLabel || "Date inconnue",
      score: fresh?.score,
    });
    items.push({
      id: "comp",
      label: "Signal package",
      ok: comp?.vs?.fit === "above" || comp?.vs?.fit === "ok" || Boolean(comp?.min),
      weight: 10,
      hint: comp?.vs?.label || CompSignal?.formatRange?.(comp) || "—",
      score: comp?.vs?.score,
    });
    items.push({
      id: "cover",
      label: "Lettre / pitch",
      ok: hasCover,
      weight: 12,
      hint: hasCover ? "Prêt" : "Génère une lettre",
    });
    items.push({
      id: "contact",
      label: "Contact RH / CP",
      ok: hasContact,
      weight: 8,
      hint: hasContact ? "OK" : "Email Finder",
    });
    items.push({
      id: "autofill",
      label: "Pack AutoFill",
      ok: autofillReady,
      weight: 8,
      hint: autofillReady ? "OK" : "Construire le pack",
    });

    let workFit = ctx.workFit;
    if (!workFit && typeof WorkPrefs !== "undefined") {
      workFit = WorkPrefs.matchJob(job, profile);
    }
    if (workFit) {
      items.push({
        id: "work_mode",
        label: "Lieu / remote",
        ok: workFit.fit === "strong" || workFit.fit === "ok",
        weight: 10,
        hint: workFit.label + (workFit.arrangement?.label ? ` · ${workFit.arrangement.label}` : ""),
        score: workFit.score,
      });
    }

    const totalW = items.reduce((a, i) => a + i.weight, 0);
    const earned = items.reduce((a, i) => a + (i.ok ? i.weight : 0), 0);
    const total = Math.round((earned / totalW) * 100);
    let tone = "warn";
    let verdict = "Encore 2–3 briques";
    if (total >= 78) {
      tone = "ok";
      verdict = "Prêt à postuler";
    } else if (total >= 55) {
      tone = "lime";
      verdict = "Presque — complète les gaps";
    } else if (total < 40) {
      tone = "bad";
      verdict = "Trop tôt — renforce le pack";
    }

    return {
      total,
      tone,
      verdict,
      items,
      blockers: items.filter((i) => !i.ok),
      canSend: total >= 55,
    };
  }

  return { score };
})();

window.ApplyReadiness = ApplyReadiness;
