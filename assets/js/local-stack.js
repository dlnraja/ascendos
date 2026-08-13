/**
 * LocalStack — every AscendOS capability works without connectors / API keys.
 * Connectors only *upgrade* the path; they never block the product.
 */
const LocalStack = (() => {
  function connectorsOf(state = {}) {
    return state.connectors || {};
  }

  function has(val) {
    return Boolean(String(val || "").trim());
  }

  /** Snapshot: what works right now (local vs upgraded). */
  function capabilities(state = {}) {
    const c = connectorsOf(state);
    const profile = state.profile || {};
    return [
      {
        id: "jobs",
        label: "Radar offres",
        mode: has(c.aggregateApiBase) ? "backend" : "local",
        ok: true,
        detail: has(c.aggregateApiBase)
          ? "Backend agrégateur + fallback navigateur"
          : "APIs/RSS publics dans le navigateur (0 clé)",
      },
      {
        id: "adzuna",
        label: "Adzuna",
        mode: has(c.adzunaAppId) && has(c.adzunaAppKey) ? "key" : "skipped",
        ok: true,
        detail:
          has(c.adzunaAppId) && has(c.adzunaAppKey)
            ? "Clés présentes"
            : "Ignoré — sources gratuites compensent",
      },
      {
        id: "email",
        label: "Email Finder",
        mode: has(c.hunterApiKey) || (has(c.underIaApiKey) && has(c.underIaApiBase)) ? "api" : "local",
        ok: true,
        detail: "Permutator + cartes + MX toujours actifs",
      },
      {
        id: "mx",
        label: "Check MX",
        mode: "local",
        ok: true,
        detail: "DNS-over-HTTPS (aucune clé)",
      },
      {
        id: "session",
        label: "Session",
        mode: has(c.gmailClientId) ? "oauth_ready" : "local",
        ok: true,
        detail: has(c.gmailClientId)
          ? "OAuth Google possible"
          : "Session locale via profil (email / LinkedIn)",
      },
      {
        id: "mail_draft",
        label: "Brouillons mail",
        mode: "mailto",
        ok: Boolean(profile.email) || true,
        detail: "mailto: / Gmail compose URL — sans OAuth",
      },
      {
        id: "cv_letter",
        label: "CV / lettres",
        mode: "local",
        ok: true,
        detail: "Génération locale honnête",
      },
      {
        id: "autofill",
        label: "AutoFill",
        mode: "local",
        ok: true,
        detail: "Bookmarklet + pack profil",
      },
    ];
  }

  /**
   * Aggregate jobs: try self-hosted backend → browser free sources.
   * Never requires Adzuna / Worker / Vercel.
   */
  async function aggregateJobs({
    query = "",
    hours = 24,
    enabledIds = null,
    customRss = [],
    connectors = {},
    force = false,
    onProgress = null,
  } = {}) {
    const report = [];
    let jobs = [];
    const apiBase = String(connectors.aggregateApiBase || "").replace(/\/$/, "");

    if (apiBase) {
      onProgress?.({ id: "backend", status: "start", label: "Backend" });
      try {
        if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("aggregate_run");
        const payload =
          typeof AscendQuotas !== "undefined"
            ? AscendQuotas.sanitizeAggregatePayload({
                query,
                hours,
                sources: enabledIds,
                rss: customRss,
              })
            : { query, hours, sources: enabledIds, rss: customRss };
        const fetchFn = typeof AscendResilience !== "undefined" ? AscendResilience.fetch : fetch;
        const res = await fetchFn(`${apiBase}/aggregate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          timeoutMs: 12000,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        jobs = data.jobs || [];
        report.push(...(data.report || [{ id: "backend", status: "ok", count: jobs.length }]));
        onProgress?.({ id: "backend", status: "ok", count: jobs.length });
        if (jobs.length) {
          return { jobs, report, path: "backend", degraded: false };
        }
        report.push({ id: "backend", status: "empty", note: "Réponse vide → fallback navigateur" });
      } catch (e) {
        report.push({
          id: "backend",
          status: "down",
          note: `${e.message || "backend KO"} → local`,
        });
        onProgress?.({ id: "backend", status: "down" });
      }
    }

    // Local free stack (no keys)
    const freeIds = (enabledIds || []).filter((id) => id !== "adzuna");
    const hasAdzuna = has(connectors.adzunaAppId) && has(connectors.adzunaAppKey);
    const ids =
      freeIds.length || enabledIds == null
        ? enabledIds == null
          ? null
          : hasAdzuna
            ? enabledIds
            : freeIds.length
              ? freeIds
              : enabledIds.filter((id) => id !== "adzuna")
        : enabledIds;

    if (typeof AscendQuotas !== "undefined" && !apiBase) {
      try {
        AscendQuotas.consume("aggregate_run");
      } catch {
        /* continue offline — don't block radar */
      }
    }

    let out = { jobs: [], report: [] };
    try {
      out = await JobSources.aggregate({
        query,
        hours,
        enabledIds: ids,
        customRss,
        apiKeys: {
          adzunaAppId: connectors.adzunaAppId,
          adzunaAppKey: connectors.adzunaAppKey,
        },
        force,
        onProgress,
      });
    } catch (e) {
      report.push({ id: "local_aggregate", status: "down", note: e.message });
      out = { jobs: [], report: [] };
    }

    // Mark adzuna skipped if no keys
    if (!hasAdzuna && (enabledIds || []).includes("adzuna")) {
      report.push({
        id: "adzuna",
        status: "skipped_no_key",
        note: "Pas de clés — Remotive/RemoteOK/RSS compensent",
      });
    }

    let path = "local";
    let degraded = (out.report || []).some((r) =>
      ["error", "down", "throttled", "skipped_no_key", "fallback_cache"].includes(r.status)
    );

    // All live sources dead → merge long-lived caches
    if (!(out.jobs || []).length && typeof JobSources !== "undefined") {
      const cached = [];
      for (const s of JobSources.SOURCES || []) {
        const c = JobSources.getCached?.(s.id, 14 * 24 * 3600 * 1000);
        if (c?.length) cached.push(...c);
      }
      if (cached.length) {
        out.jobs = cached;
        path = "cache";
        degraded = true;
        report.push({
          id: "offline_cache",
          status: "ok",
          count: cached.length,
          note: "Sources down — cache local servi",
        });
      } else {
        path = "offline";
        degraded = true;
        report.push({
          id: "offline",
          status: "degraded",
          note: "Réseau / sources KO — app locale OK (CV, file, profil)",
        });
      }
    }

    return {
      jobs: out.jobs || [],
      report: [...report, ...(out.report || [])],
      path,
      degraded,
    };
  }

  /**
   * Email resolution: optional APIs then always full local permutator.
   */
  async function resolveEmails({
    domain,
    fullName,
    connectors = {},
    learned = {},
    preferApis = true,
  } = {}) {
    const dom = EmailFinder.normalizeDomain(domain);
    const name = String(fullName || "").trim();
    const notes = [];
    let enriched = null;
    let patternPatch = null;

    if (!dom || !name) {
      return {
        candidates: [],
        enriched: null,
        notes: ["Domaine + nom requis"],
        path: "none",
      };
    }

    const hunterKey = connectors.hunterApiKey;
    const underKey = connectors.underIaApiKey;
    const underBase = connectors.underIaApiBase;

    if (preferApis && underKey && underBase) {
      try {
        const u = await EmailFinder.underIaFind({
          apiKey: underKey,
          apiBase: underBase,
          domain: dom,
          fullName: name,
        });
        if (u.found) {
          enriched = { email: u.email, score: u.score, method: "under_ia" };
          notes.push("Under IA OK");
        } else notes.push("Under IA sans match → local");
      } catch (e) {
        notes.push(`Under IA ignoré: ${e.message}`);
      }
    }

    if (preferApis && hunterKey) {
      try {
        const pat = await EmailFinder.hunterDomainPattern({ apiKey: hunterKey, domain: dom });
        if (pat.patternId) {
          patternPatch = {
            domain: dom,
            samples: (pat.emails || []).map((e) => ({ email: e.email, name: e.name, at: Date.now() })),
            patternVotes: { [pat.patternId]: 2 },
            topPattern: pat.patternId,
            topLabel: EmailFinder.PATTERNS.find((p) => p.id === pat.patternId)?.label || pat.pattern,
            confidence: 0.9,
          };
          notes.push(`Hunter pattern: ${pat.patternId}`);
        }
      } catch (e) {
        notes.push(`Hunter domain ignoré: ${e.message}`);
      }
      if (!enriched) {
        try {
          const found = await EmailFinder.hunterFind({
            apiKey: hunterKey,
            domain: dom,
            fullName: name,
          });
          if (found.found) {
            enriched = { email: found.email, score: found.score, method: "hunter" };
            notes.push("Hunter finder OK");
          } else notes.push("Hunter sans match → local");
        } catch (e) {
          notes.push(`Hunter finder ignoré: ${e.message}`);
        }
      }
    }

    if (!hunterKey && !(underKey && underBase)) {
      notes.push("Aucune clé API — permutator local seul");
    }

    const learnedMerged = { ...learned };
    if (patternPatch) learnedMerged[dom] = patternPatch;

    const permutes = EmailFinder.generateCandidates({
      fullName: name,
      domain: dom,
      learned: learnedMerged,
    });

    let candidates = permutes;
    if (enriched) {
      candidates = [
        {
          email: enriched.email,
          patternId: enriched.method,
          patternLabel: enriched.method === "under_ia" ? "Under IA" : "Hunter",
          confidence: enriched.score || 90,
          rank: 1,
          preferred: true,
          method: enriched.method,
        },
        ...permutes.filter((p) => p.email !== enriched.email),
      ];
    }

    return {
      candidates,
      enriched,
      patternPatch,
      notes,
      path: enriched ? "api+local" : "local",
    };
  }

  /** Local identity session from profile — no OAuth client id. */
  function bindLocalSession(profile = {}, provider = "local") {
    if (typeof AscendSession === "undefined") return null;
    return AscendSession.save({
      provider,
      sub: profile.email || profile.linkedinUrl || profile.fullName || "local",
      email: profile.email || "",
      name: profile.fullName || "",
      picture: "",
      linkedinUrl: profile.linkedinUrl || "",
    });
  }

  /** Compose mail without Gmail OAuth. */
  function openMailDraft({ to = "", subject = "", body = "" } = {}) {
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Gmail web compose as secondary (no OAuth)
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      window.open(mailto, "_self");
    } catch {
      window.open(gmail, "_blank", "noopener,noreferrer");
    }
    return { mailto, gmail };
  }

  function statusChipsHtml(state, escapeHtml) {
    const caps = capabilities(state);
    let html = caps
      .map((c) => {
        const tone =
          c.mode === "local" || c.mode === "mailto"
            ? "chip-ok"
            : c.mode.includes("skip")
              ? "chip-warn"
              : "chip-lime";
        return `<span class="chip ${tone}" title="${escapeHtml(c.detail)}">${escapeHtml(c.label)} · ${escapeHtml(
          c.mode
        )}</span>`;
      })
      .join(" ");
    if (typeof AscendResilience !== "undefined") {
      const down = AscendResilience.statusReport().filter((h) => h.cooling);
      if (down.length) {
        html +=
          " " +
          down
            .map(
              (h) =>
                `<span class="chip chip-warn" title="${escapeHtml(h.reason)}">down · ${escapeHtml(h.host)}</span>`
            )
            .join(" ");
      }
    }
    return html;
  }

  return {
    capabilities,
    aggregateJobs,
    resolveEmails,
    bindLocalSession,
    openMailDraft,
    statusChipsHtml,
  };
})();

window.LocalStack = LocalStack;
