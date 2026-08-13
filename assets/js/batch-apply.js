/**
 * BatchApply + LoopApply — sequential candidatures with autofill packs.
 * Human-in-the-loop: never auto-submit third-party forms.
 */
const BatchApply = (() => {
  const DEFAULT_LOOP = {
    rounds: 1,
    pauseMs: 2500,
    requireReady: 55,
    openTabs: true,
    rebuildPack: true,
  };

  function pickJobs(state, { mode = "queue", limit = 10, minReady = 0 } = {}) {
    let jobs = [];
    if (mode === "queue") {
      jobs = (state.applyQueue || [])
        .map((q) => state.jobs.find((j) => j.id === q.jobId))
        .filter(Boolean);
    } else if (mode === "prime") {
      if (typeof FreshRadar !== "undefined") {
        jobs = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
          maxAgeMs: (state.settings?.freshWindowHours || 24) * 3600 * 1000,
        })
          .filter((j) => j.prime?.urgency === "apply_now" || j.prime?.urgency === "high")
          .slice(0, limit);
      }
    } else {
      jobs = [...(state.jobs || [])].filter((j) => j.status === "saved").slice(0, limit);
    }
    return jobs.slice(0, limit);
  }

  async function runBatch({
    state,
    jobs,
    onStep,
    onNeedProfile,
    helpers,
    opts = {},
  }) {
    const cfg = { ...DEFAULT_LOOP, ...opts };
    const report = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      onStep?.({
        index: i,
        total: jobs.length,
        job,
        phase: "start",
        message: `Batch ${i + 1}/${jobs.length} · ${job.title}`,
      });

      // Missing profile data → interactive ask once
      if (typeof PublicEnrich !== "undefined") {
        const miss = PublicEnrich.missingForAutofill(state.profile);
        if (miss.length && onNeedProfile) {
          const patch = await onNeedProfile(miss);
          if (patch && Object.keys(patch).length) {
            Object.assign(state.profile, patch);
            helpers?.persist?.();
          }
        }
      }

      if (helpers?.ensureCover) helpers.ensureCover(job);
      if (helpers?.ensureCv) helpers.ensureCv(job);
      if (helpers?.ensureInterview && cfg.interview) helpers.ensureInterview(job);

      let readiness = null;
      if (helpers?.readiness) {
        readiness = helpers.readiness(job);
        if (cfg.requireReady && readiness.total < cfg.requireReady) {
          report.push({
            jobId: job.id,
            status: "skipped_low_ready",
            readiness: readiness.total,
            title: job.title,
          });
          onStep?.({
            index: i,
            total: jobs.length,
            job,
            phase: "skip",
            message: `Skip · Ready ${readiness.total}% < ${cfg.requireReady}`,
          });
          continue;
        }
      }

      let pack = null;
      if (cfg.rebuildPack && helpers?.buildPack) {
        pack = helpers.buildPack(job.id);
        job.autofillReady = true;
      }

      if (cfg.openTabs && job.url) {
        try {
          window.open(job.url, "_blank", "noopener,noreferrer");
        } catch {
          /* popup blocked */
        }
      }

      report.push({
        jobId: job.id,
        status: "prepared",
        readiness: readiness?.total,
        title: job.title,
        url: job.url || "",
        packReady: Boolean(pack),
      });

      onStep?.({
        index: i,
        total: jobs.length,
        job,
        phase: "prepared",
        message: `Pack prêt · ${job.company} — clique le bookmarklet sur l’onglet`,
      });

      if (i < jobs.length - 1 && cfg.pauseMs) {
        await new Promise((r) => setTimeout(r, cfg.pauseMs));
      }
    }
    return { report, count: report.length };
  }

  async function runLoop(args) {
    const rounds = Math.max(1, Math.min(5, Number(args.opts?.rounds) || 1));
    const all = [];
    for (let r = 0; r < rounds; r++) {
      args.onStep?.({
        index: r,
        total: rounds,
        phase: "loop_round",
        message: `Boucle apply · tour ${r + 1}/${rounds}`,
      });
      if (r > 0 && args.helpers?.refreshFresh) {
        try {
          await args.helpers.refreshFresh();
        } catch {
          /* continue with local jobs */
        }
      }
      const jobs = pickJobs(args.state, {
        mode: args.opts?.mode || "queue",
        limit: args.opts?.limit || 8,
      });
      const out = await runBatch({ ...args, jobs });
      all.push({ round: r + 1, ...out });
      if (args.opts?.pauseBetweenRoundsMs) {
        await new Promise((r) => setTimeout(r, args.opts.pauseBetweenRoundsMs));
      }
    }
    return { rounds: all };
  }

  return { pickJobs, runBatch, runLoop, DEFAULT_LOOP };
})();

window.BatchApply = BatchApply;
