/**
 * CompSignal — extract salary / package signals from job text (local).
 * Better than keyword-only: parses ranges, k€, equity hints, compares to pretentions.
 */
const CompSignal = (() => {
  function parseExpectation(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/\s/g, "").toLowerCase();
    const range = s.match(/(\d+[.,]?\d*)\s*[-–àa\/]\s*(\d+[.,]?\d*)/);
    if (range) {
      let a = parseFloat(range[1].replace(",", "."));
      let b = parseFloat(range[2].replace(",", "."));
      if (a < 1000) a *= 1000;
      if (b < 1000) b *= 1000;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const one = s.match(/(\d+[.,]?\d*)k?/);
    if (!one) return null;
    let v = parseFloat(one[1].replace(",", "."));
    if (v < 1000) v *= 1000;
    return { min: v * 0.92, max: v * 1.08 };
  }

  function extractFromText(text) {
    const t = String(text || "");
    const lower = t.toLowerCase();
    const out = {
      min: null,
      max: null,
      currency: "EUR",
      equity: /bspce|equity|stock|actions?\s+gratuit|rsu|stock[- ]?options/i.test(t),
      bonus: /bonus|variable|intéressement|participation/i.test(t),
      remotePay: /remote|télétravail|full[- ]?remote/i.test(t),
      raw: null,
      confidence: 0,
    };

    const patterns = [
      /(\d{2,3})\s*[-–à]\s*(\d{2,3})\s*k\s*€?/i,
      /(\d{2,3})\s*k\s*[-–à\/]\s*(\d{2,3})\s*k/i,
      /(\d{2,3}[.,]\d{3}|\d{4,6})\s*€?\s*[-–à]\s*(\d{2,3}[.,]\d{3}|\d{4,6})\s*€/i,
      /(?:salaire|rémunération|package|comp(?:ensation)?|brut)\s*[:=]?\s*(\d{2,3})\s*k/i,
      /(\d{2,3})\s*000\s*€/,
    ];

    for (const re of patterns) {
      const m = t.match(re);
      if (!m) continue;
      let a = parseFloat(String(m[1]).replace(",", ".").replace(/\s/g, ""));
      let b = m[2] ? parseFloat(String(m[2]).replace(",", ".").replace(/\s/g, "")) : a;
      if (a < 1000) a *= 1000;
      if (b < 1000) b *= 1000;
      if (a > 300000 || b > 300000) continue;
      out.min = Math.min(a, b);
      out.max = Math.max(a, b);
      out.raw = m[0];
      out.confidence = m[2] ? 85 : 65;
      break;
    }

    if (!out.min && /tjm|journalier/i.test(lower)) {
      const tjm = t.match(/(\d{2,4})\s*€?\s*(?:\/\s*j|tjm)/i);
      if (tjm) {
        const day = parseInt(tjm[1], 10);
        out.min = Math.round(day * 200);
        out.max = Math.round(day * 220);
        out.raw = tjm[0];
        out.confidence = 55;
        out.note = "Estimé depuis TJM (indicatif)";
      }
    }

    return out;
  }

  function extractFromJob(job) {
    const blob = [job?.title, job?.company, job?.description, job?.salary, ...(job?.tags || [])]
      .filter(Boolean)
      .join("\n");
    return extractFromText(blob);
  }

  function compare(jobComp, expectationRaw) {
    const exp = parseExpectation(expectationRaw);
    if (!jobComp?.min || !exp) {
      return {
        fit: "unknown",
        score: 50,
        label: jobComp?.min ? "Offre chiffrée · pretentions à préciser" : "Pas de fourchette détectée",
        jobComp,
        exp,
      };
    }
    const mid = (jobComp.min + jobComp.max) / 2;
    const target = (exp.min + exp.max) / 2;
    const ratio = mid / target;
    let fit = "ok";
    let score = 70;
    let label = "Dans ta zone";
    if (ratio >= 1.12) {
      fit = "above";
      score = 92;
      label = "Au-dessus de tes pretentions";
    } else if (ratio >= 0.95) {
      fit = "ok";
      score = 80;
      label = "Aligné";
    } else if (ratio >= 0.8) {
      fit = "stretch";
      score = 55;
      label = "Un peu sous ta cible";
    } else {
      fit = "below";
      score = 30;
      label = "Sous pretentions";
    }
    if (jobComp.equity) {
      score = Math.min(100, score + 6);
      label += " · equity possible";
    }
    return { fit, score, label, jobComp, exp, mid, target };
  }

  function enrichJob(job, profile) {
    const jobComp = extractFromJob(job);
    const vs = compare(jobComp, profile?.salaryExpectation);
    return { ...jobComp, vs };
  }

  function formatRange(comp) {
    if (!comp?.min) return "—";
    const fmt = (n) =>
      n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
    if (comp.max && comp.max !== comp.min) return `${fmt(comp.min)}–${fmt(comp.max)}€`;
    return `${fmt(comp.min)}€`;
  }

  return { extractFromText, extractFromJob, parseExpectation, compare, enrichJob, formatRange };
})();

window.CompSignal = CompSignal;
