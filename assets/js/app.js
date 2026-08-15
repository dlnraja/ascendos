/* AscendOS dashboard app */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let state = AscendStore.load();

  const SAMPLE_JOBS = [
    {
      id: AscendStore.uid("job"),
      title: "Tech Lead Plateforme Data",
      company: "Groupe bancaire CAC40",
      location: "Paris / hybrid",
      employerType: "end_client",
      status: "saved",
      url: "",
      description:
        "Poste interne client final. Lead une squad data produit, ownership roadmap, stack cloud, management de 5 ingénieurs. Package 75-90k + intéressement + BSPCE possible.",
      tags: ["lead", "data", "interne", "cac 40"],
      postedAt: Date.now() - 25 * 60 * 1000,
      createdAt: Date.now(),
    },
    {
      id: AscendStore.uid("job"),
      title: "Cadre de santé — coordination parcours",
      company: "CHU régional",
      location: "Lyon",
      employerType: "end_client",
      status: "saved",
      url: "",
      description:
        "Coordination parcours patient, encadrement d'équipe soignante, protocole qualité, creation de poste suite réorganisation.",
      tags: ["santé", "management", "qualité"],
      postedAt: Date.now() - 3 * 60 * 60 * 1000,
      createdAt: Date.now(),
    },
    {
      id: AscendStore.uid("job"),
      title: "Head of Sales Mid-Market",
      company: "Scale-up SaaS B2B",
      location: "Remote EU",
      employerType: "end_client",
      status: "applied",
      url: "",
      description:
        "Manager une équipe de 6 AE, quota national, BSPCE, pipeline, coaching. Passage commercial → management.",
      tags: ["sales", "management", "bspce", "remote"],
      postedAt: Date.now() - 20 * 60 * 60 * 1000,
      createdAt: Date.now(),
    },
    {
      id: AscendStore.uid("job"),
      title: "Conducteur de travaux — multi-sites",
      company: "Groupe BTP national",
      location: "Nantes",
      employerType: "end_client",
      status: "saved",
      url: "",
      description:
        "Pilotage multi-chantiers, budget, sous-traitants, sécurité. Évolution depuis technicien / chef d'équipe. Package attractif secteur en tension.",
      tags: ["btp", "management", "budget", "pénurie"],
      postedAt: Date.now() - 50 * 60 * 1000,
      createdAt: Date.now(),
    },
  ];

  function persist() {
    AscendStore.save(state);
    AscendSecurity.persistSecretsFrom(state.connectors).catch(() => {
      /* vault write best-effort */
    });
  }

  function renderQuotas() {
    const el = $("#quota-status");
    if (!el || typeof AscendQuotas === "undefined") return;
    el.innerHTML = AscendQuotas.statusList()
      .map((u) => {
        const tone = u.remaining <= 0 ? "chip-bad" : u.remaining <= Math.ceil(u.max * 0.2) ? "chip-warn" : "chip-ok";
        return `<span class="chip ${tone}" title="${escapeHtml(u.period)}">${escapeHtml(u.label)} · ${u.used}/${u.max}</span>`;
      })
      .join("");
  }

  /** Single facade — AscendCore === LocalStack (local → upgrade → degrade). */
  function core() {
    return typeof AscendCore !== "undefined" ? AscendCore : typeof LocalStack !== "undefined" ? LocalStack : null;
  }

  function pathChip(modeOrPath, title = "") {
    const c = core();
    if (c?.pathChipHtml) return c.pathChipHtml(modeOrPath, escapeHtml, title);
    return `<span class="chip chip-ok">${escapeHtml(modeOrPath || "local")}</span>`;
  }

  async function sendViaCore(draft) {
    const c = core();
    if (c?.email?.send) return c.email.send(draft, { confirm: true });
    if (typeof Connectors !== "undefined") return Connectors.sendOrDraft({ ...draft, confirm: true });
    return { ok: false, path: "mailto", error: "Facade absente" };
  }

  function prepareOutreachViaCore({ job, contact, email } = {}) {
    const c = core();
    if (c?.email?.prepareOutreach) {
      return c.email.prepareOutreach({ profile: state.profile, job, contact, email });
    }
    return EmailFinder.buildDualOutreach({ profile: state.profile, job, contact, email });
  }

  function renderStackChip() {
    const el = $("#stack-chip");
    if (!el) return;
    const c = core();
    const sum = c?.stackSummary?.(state) || { text: "Stack · local", tone: "ok", path: "local" };
    el.textContent = sum.text;
    el.className = `chip chip-${sum.tone || "ok"}`;
    el.title = "AscendCore · local / upgrade / cooldown";
  }

  function renderSession() {
    const s = AscendSession.load();
    const text = AscendSession.label(s);
    const ok = AscendSession.isSignedIn(s);
    ["#session-chip", "#session-status"].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.textContent = text;
      el.className = `chip ${ok ? "chip-ok" : "chip-info"}`;
    });
    const out = $("#btn-session-out");
    if (out) out.hidden = !ok;
    renderStackChip();
  }

  async function startGoogleSession() {
    const id = state.connectors.gmailClientId || $("#gmail-client-id")?.value.trim();
    if (!id) {
      // Compensate: local session from profile — no OAuth connector required
      const facade = core();
      const ensured = facade?.session?.ensure
        ? facade.session.ensure(state.profile, state.connectors)
        : { session: facade?.session?.bindLocal?.(state.profile, "local") };
      const sess = ensured?.session;
      if (sess && (sess.email || sess.name)) {
        state.profile = AscendSession.mergeIntoProfile(state.profile, sess);
        persist();
        renderSession();
        toast("Session locale (profil) — OAuth optionnel si tu ajoutes un Client ID plus tard");
        return;
      }
      toast("Remplis email/nom dans le Profil pour une session locale, ou ajoute un Client ID Google");
      navigate("profile");
      return;
    }
    const redirect = window.location.href.split("#")[0].split("?")[0];
    const nonce = AscendSecurity.createOAuthState("google_session");
    window.location.href = AscendSession.buildGoogleSessionAuthUrl(id, redirect, nonce);
  }

  function bindLinkedInSessionLocal() {
    const url = state.profile.linkedinUrl || $("#pf-linkedin")?.value.trim() || "";
    const name = state.profile.fullName || $("#pf-name")?.value.trim() || "";
    const email = state.profile.email || $("#pf-email")?.value.trim() || "";
    if (!url && !name && !email) {
      toast("Remplis d’abord le profil (nom / email / URL LinkedIn)");
      navigate("profile");
      return;
    }
    AscendSession.bindLinkedInLocal({ name, email, linkedinUrl: url });
    state.profile = AscendSession.mergeIntoProfile(state.profile);
    state.connectors.linkedinConnected = true;
    persist();
    renderSession();
    renderConnectors();
    toast("Session LinkedIn liée localement — rien envoyé à AscendOS");
  }

  function signOutSession() {
    AscendSession.clear();
    AscendSecurity.clearOAuthToken();
    state.connectors.gmailConnected = false;
    state.connectors.linkedinConnected = false;
    persist();
    renderSession();
    renderConnectors();
    toast("Session terminée — données métier toujours locales");
  }

  function lockVaultUi() {
    AscendSecurity.lock();
    AscendSecurity.clearSecretsFromState(state);
    AscendSecurity.clearOAuthToken();
    state.connectors.gmailConnected = false;
    render();
    toast("Coffre verrouillé — clés & tokens effacés de la mémoire");
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function profileResumeText() {
    const p = state.profile;
    return [
      p.fullName,
      p.headline,
      p.summary,
      (p.skills || []).join(", "),
      (p.experiences || []).join("\n"),
      p.careerGoal,
    ].join("\n");
  }

  function ensureSeed() {
    if (!state.jobs.length) {
      state.jobs = SAMPLE_JOBS;
      persist();
    }
  }

  function navigate(view) {
    $$(".side-link").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    const titles = {
      cockpit: ["One-Click", "Un workflow. Un bouton. Le reste est dans l'Atelier."],
      job: ["Fiche offre", "Intelligence unifiée : levier, ATS, package, readiness, lettre, entretien."],
      dashboard: ["Vue rapide", "Offres et ajout manuel."],
      profile: ["Profil Vault", "CV + réseau pro + imports IA."],
      accelerator: ["Accélérateur", "Multi-vecteurs d'upgrade — tous métiers."],
      passerelles: ["Passerelles & leviers", "Ponts de carrière + coups de chance + CV honnête."],
      ats: ["ATS Match", "Mots-clés profil ↔ offre."],
      cv: ["CV Studio", "Versions orientées sans mentir, tous métiers."],
      linkedin: ["LinkedIn Boost", "Headline, about, positionnement."],
      pipeline: ["Pipeline", "Du saved à l'offre, avec score carrière."],
      apply: ["Apply Queue", "File priorisée — frais + fort levier d'abord."],
      fresh: ["Radar frais", "Offres <1h / <24h — sois le premier à postuler."],
      autofill: ["AutoFill CRM", "Remplit les portails ATS depuis ton profil."],
      emails: ["Email Finder RH/CP", "Cartes, API optionnelle, permutator → mails."],
      connectors: ["Connecteurs", "Session locale + magic links — zéro base AscendOS."],
    };
    const [t, s] = titles[view] || ["AscendOS", ""];
    $("#view-title").textContent = t;
    $("#view-sub").textContent = s;
    location.hash = view;
    render();
  }

  function chipClass(tone) {
    return (
      {
        ok: "chip-ok",
        lime: "chip-lime",
        warn: "chip-warn",
        bad: "chip-bad",
        info: "chip-info",
      }[tone] || "chip-info"
    );
  }

  let selectedWorkflowId = "morning_sprint";
  let workflowRunning = false;
  let selectedJobId = null;

  function renderCockpit() {
    const pick = $("#wf-pick");
    if (!pick) return;
    pick.innerHTML = AscendWorkflows.WORKFLOWS.map((w) => {
      const meta = AscendWorkflows.pathChip?.(w) || { label: "local", tone: "ok" };
      const chipClass = meta.className || `chip chip-${meta.tone || "ok"}`;
      return `<button type="button" class="wf-card${w.id === selectedWorkflowId ? " active" : ""}" data-wf="${w.id}" role="option" aria-selected="${
        w.id === selectedWorkflowId
      }">
        <strong>${escapeHtml(w.label)}</strong>
        <span class="${chipClass}" style="margin:0.35rem 0 0.25rem;display:inline-block;margin-left:0">${escapeHtml(
          meta.label || meta.path || "local"
        )}</span>
        <span>${escapeHtml(w.blurb)}</span>
      </button>`;
    }).join("");

    const wf = AscendWorkflows.byId(selectedWorkflowId);
    const btn = $("#btn-oneclick");
    if (btn && wf) btn.textContent = wf.oneButton;

    const ranked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
      maxAgeMs: (state.settings.freshWindowHours || 24) * 3600 * 1000,
    });
    const prime = ranked.filter((j) => j.prime.fresh.tier.id === "prime" || j.prime.urgency === "apply_now");
    if ($("#ck-jobs")) $("#ck-jobs").textContent = String(state.jobs.length);
    if ($("#ck-prime")) $("#ck-prime").textContent = String(prime.length);
    if ($("#ck-queue")) $("#ck-queue").textContent = String(state.applyQueue.length);
    renderWeeklyStrip();
  }

  function renderWeeklyStrip() {
    const el = $("#weekly-strip");
    if (!el || typeof WeeklyPlan === "undefined") return;
    const snap = WeeklyPlan.snapshot();
    el.innerHTML = `<div class="weekly-head"><strong>Semaine ${escapeHtml(snap.week)}</strong>
      <span class="chip ${snap.streak ? "chip-ok" : "chip-info"}">${snap.streak}j streak</span></div>
      <div class="weekly-bars">${snap.bars
        .map(
          (b) => `<div class="weekly-bar" title="${escapeHtml(b.label)}">
          <span>${escapeHtml(b.label)} ${b.used}/${b.max}</span>
          <div class="meter-bar"><i style="width:${b.pct}%"></i></div>
        </div>`
        )
        .join("")}</div>`;
  }

  function jobContext(job) {
    if (!job) return null;
    const career = CareerAccelerator.scoreJob(job, state.profile);
    const fresh = FreshRadar.freshnessScore(job);
    const prime = FreshRadar.primeApplyScore(job, state.profile);
    const comp = CompSignal.enrichJob(job, state.profile);
    const resume = profileResumeText();
    const ats = AtsEngine.analyze(resume, `${job.title}\n${job.company}\n${job.description || ""}`);
    job.atsScore = ats.score;
    const hasCover = Boolean(job.coverLetter) || (state.letters || []).some((l) => l.jobId === job.id);
    const hasContact = (state.contacts || []).some((c) => c.jobId === job.id);
    const readiness = ApplyReadiness.score(job, state.profile, {
      careerScore: career.score,
      atsScore: ats.score,
      fresh,
      comp,
      hasCover,
      hasContact,
      autofillReady: Boolean(job.autofillReady),
    });
    return { career, fresh, prime, comp, ats, readiness };
  }

  function openJob(jobId) {
    selectedJobId = jobId;
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) {
      toast("Offre introuvable");
      return;
    }
    navigate("job");
    renderJobIntel();
  }

  function ensureCoverForJob(job) {
    const { bridges } = Passerelles.findBridges(state.profile);
    const bridge = bridges[0] || null;
    const ctx = jobContext(job);
    const memory =
      typeof ApplyMemory !== "undefined" ? ApplyMemory.lessonsRelevant(state, job) : [];
    const letter =
      core()?.docs?.letter?.({
        profile: state.profile,
        job,
        bridge,
        atsGaps: ctx?.ats?.gaps || [],
        memory,
      }) ||
      CoverLetter.generate({
        profile: state.profile,
        job,
        bridge,
        atsGaps: ctx?.ats?.gaps || [],
        memory,
      });
    job.coverLetter = letter.body;
    state.letters = state.letters || [];
    state.letters.unshift(letter);
    state.letters = state.letters.slice(0, 40);
    WeeklyPlan.log("boost", { kind: "cover", jobId: job.id });
    return letter;
  }

  function ensureCvForJob(job) {
    const { bridges } = Passerelles.findBridges(state.profile);
    const bridge = bridges[0] || null;
    const ctx = jobContext(job);
    const memory =
      typeof ApplyMemory !== "undefined" ? ApplyMemory.lessonsRelevant(state, job) : [];
    const cv =
      core()?.docs?.cv?.({
        profile: state.profile,
        job,
        bridge,
        atsGaps: ctx?.ats?.gaps || [],
        memory,
      }) ||
      CvTailor.generate({
        profile: state.profile,
        job,
        bridge,
        atsGaps: ctx?.ats?.gaps || [],
        memory,
      });
    job.tailoredCv = cv.body;
    job.tailoredCvHtml = cv.html;
    state.cvVersions = state.cvVersions || [];
    state.cvVersions.unshift(cv);
    state.cvVersions = state.cvVersions.slice(0, 40);
    WeeklyPlan.log("boost", { kind: "cv", jobId: job.id });
    return cv;
  }

  function ensureInterviewForJob(job) {
    const pack = InterviewPrep.generate({
      profile: state.profile,
      job,
      vectors: state.profile.activeVectors || [],
    });
    job.interviewPack = pack;
    WeeklyPlan.log("prep", { jobId: job.id });
    return pack;
  }

  function renderJobIntel() {
    const root = $("#job-intel");
    if (!root) return;
    const job = state.jobs.find((j) => j.id === selectedJobId) || state.jobs[0];
    if (!job) {
      root.innerHTML = `<p style="color:var(--mist)">Aucune offre — ajoute-en une ou lance le Radar.</p>`;
      return;
    }
    selectedJobId = job.id;
    const ctx = jobContext(job);
    const { career, fresh, prime, comp, ats, readiness } = ctx;
    const coverPreview = (job.coverLetter || "").slice(0, 320);
    const interview = job.interviewPack;

    root.innerHTML = `
      <div class="job-intel-head">
        <div>
          <p class="section-kicker">Fiche intelligente</p>
          <h2>${escapeHtml(job.title)}</h2>
          <p class="job-intel-meta">${escapeHtml(job.company)} · ${escapeHtml(job.location || "—")}</p>
        </div>
        <div class="job-intel-scores">
          <span class="chip ${chipClass(career.tone)}">Levier ${career.score}</span>
          <span class="chip ${chipClass(fresh.tier?.tone || "info")}">${escapeHtml(fresh.tier?.short || "Frais")} · ${escapeHtml(fresh.ageLabel)}</span>
          <span class="chip chip-info">ATS ${ats.score}%</span>
          <span class="chip ${chipClass(readiness.tone)}">Ready ${readiness.total}%</span>
        </div>
      </div>

      <div class="job-intel-grid">
        <div class="panel">
          <h3>Package</h3>
          <p class="big-num">${escapeHtml(CompSignal.formatRange(comp))}</p>
          <p style="color:var(--mist)">${escapeHtml(comp.vs?.label || "—")}${comp.equity ? " · equity" : ""}${comp.bonus ? " · variable" : ""}</p>
        </div>
        <div class="panel">
          <h3>Préparation</h3>
          <p class="big-num">${readiness.total}%</p>
          <p style="color:var(--mist)">${escapeHtml(readiness.verdict)}</p>
          <div class="ready-list">${readiness.items
            .map(
              (it) => `<div class="ready-item ${it.ok ? "ok" : "ko"}"><span>${it.ok ? "●" : "○"}</span> ${escapeHtml(
                it.label
              )} <em>${escapeHtml(it.hint)}</em></div>`
            )
            .join("")}</div>
        </div>
      </div>

      <div class="panel" style="margin-top:1rem">
        <h3>Pourquoi cette offre</h3>
        <ul class="list-gaps">${(career.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("") || "<li>—</li>"}</ul>
        ${
          career.passerelle?.bridge
            ? `<div class="playbook-note">Passerelle : ${escapeHtml(career.passerelle.bridge.title)}</div>`
            : ""
        }
      </div>

      <div class="grid-2" style="margin-top:1rem">
        <div class="panel">
          <h3>Lettre / pitch</h3>
          <pre class="soft-pre">${escapeHtml(coverPreview || "Pas encore générée.")}${coverPreview.length >= 320 ? "…" : ""}</pre>
          <div class="row-actions">
            <button class="btn btn-soft" type="button" id="btn-job-cover">Générer lettre</button>
            <button class="btn btn-soft" type="button" id="btn-job-cv">Générer CV offre</button>
            <button class="btn btn-ghost" type="button" id="btn-job-copy-cover">Copier lettre</button>
          </div>
        </div>
        <div class="panel">
          <h3>Prépa entretien</h3>
          ${
            interview
              ? `<ul class="list-gaps">${interview.questions
                  .slice(0, 5)
                  .map((q) => `<li>${escapeHtml(q)}</li>`)
                  .join("")}</ul>
                 <p style="color:var(--mist);font-size:0.85rem;margin-top:0.5rem">${escapeHtml(interview.closer)}</p>`
              : `<p style="color:var(--mist)">Génère un pack questions + STAR.</p>`
          }
          <div class="row-actions">
            <button class="btn btn-soft" type="button" id="btn-job-interview">Générer prépa</button>
          </div>
        </div>
      </div>

      <div class="row-actions" style="margin-top:1rem">
        <button class="btn btn-primary" type="button" id="btn-job-queue">File Apply</button>
        <button class="btn btn-soft" type="button" id="btn-job-autofill">AutoFill</button>
        <button class="btn btn-ghost" type="button" id="btn-job-ats">Match ATS</button>
        ${job.url ? `<a class="btn btn-ghost" href="${escapeHtml(job.url)}" target="_blank" rel="noopener">Ouvrir l’annonce</a>` : ""}
      </div>`;

    $("#btn-job-cover")?.addEventListener("click", () => {
      ensureCoverForJob(job);
      persist();
      renderJobIntel();
      toast("Lettre générée (honnête, locale)");
    });
    $("#btn-job-cv")?.addEventListener("click", () => {
      const cv = ensureCvForJob(job);
      if ($("#cv-preview")) $("#cv-preview").value = cv.body;
      if ($("#cv-job")) $("#cv-job").value = job.id;
      persist();
      renderJobIntel();
      toast("CV offre généré — éditable dans CV Studio");
    });
    $("#btn-job-copy-cover")?.addEventListener("click", async () => {
      if (!job.coverLetter) ensureCoverForJob(job);
      await navigator.clipboard.writeText(job.coverLetter || "");
      persist();
      toast("Lettre copiée");
    });
    $("#btn-job-interview")?.addEventListener("click", () => {
      ensureInterviewForJob(job);
      persist();
      renderJobIntel();
      toast("Prépa entretien prête");
    });
    $("#btn-job-queue")?.addEventListener("click", () => {
      queueJob(job.id);
      WeeklyPlan.log("apply", { jobId: job.id });
      toast("Ajouté à la file");
    });
    $("#btn-job-autofill")?.addEventListener("click", () => {
      if ($("#af-job")) $("#af-job").value = job.id;
      buildAutofillPack(job.id);
      job.autofillReady = true;
      persist();
      navigate("autofill");
    });
    $("#btn-job-ats")?.addEventListener("click", () => {
      if ($("#ats-job")) $("#ats-job").value = `${job.title}\n${job.company}\n${job.description || ""}`;
      if ($("#ats-resume")) $("#ats-resume").value = profileResumeText();
      runAts();
      navigate("ats");
    });
  }

  function wfLog(msg) {
    const el = $("#wf-log");
    if (!el) return;
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
  }

  function wfSetSteps(stepIds, activeIdx) {
    const labels = {
      vectors: "Activer vecteurs intelligents",
      fresh: "Agréger offres fraîches",
      fresh_rank: "Classer par fraîcheur × levier",
      queue_prime: "Remplir Apply Queue (PRIME)",
      autofill_top: "Générer pack AutoFill",
      cover_top: "Lettre / pitch honnête",
      interview_top: "Pack entretien STAR",
      readiness_top: "Score de préparation",
      batch_prepare: "Batch Apply (packs + onglets)",
      best_job: "Choisir meilleure offre",
      cv_orient: "Orienter le CV (honnête)",
      email_hint: "Préparer Email Finder",
      passerelles: "Calculer passerelles",
      linkedin: "Préparer LinkedIn Boost",
      summary: "Résumé & prochaines actions",
    };
    const ol = $("#wf-steps");
    if (!ol) return;
    ol.innerHTML = stepIds
      .map((id, i) => {
        const cls = i < activeIdx ? "done" : i === activeIdx ? "run" : "";
        return `<li class="${cls}"><span class="dot"></span>${escapeHtml(labels[id] || id)}</li>`;
      })
      .join("");
    const fill = $("#wf-bar-fill");
    if (fill) fill.style.width = `${Math.round((activeIdx / Math.max(1, stepIds.length)) * 100)}%`;
  }

  async function runOneClickWorkflow() {
    if (workflowRunning) return;
    const wf = AscendWorkflows.byId(selectedWorkflowId);
    if (!wf) return;
    workflowRunning = true;
    const btn = $("#btn-oneclick");
    if (btn) btn.disabled = true;
    const prog = $("#wf-progress");
    if (prog) prog.hidden = false;
    if ($("#wf-log")) $("#wf-log").textContent = "";
    if ($("#wf-next-actions")) $("#wf-next-actions").innerHTML = "";
    const steps = wf.steps;
    let ctx = { topJob: null, queued: 0, pack: null };

    try {
      const sum = core()?.stackSummary?.(state);
      if (sum) wfLog(`AscendCore · ${sum.path} — ${sum.text}`);
      for (let i = 0; i < steps.length; i++) {
        wfSetSteps(steps, i);
        const step = steps[i];

        if (step === "vectors") {
          const smart = Passerelles.suggestVectorsFromProfile(state.profile);
          state.profile.activeVectors = smart.vectorIds.length
            ? smart.vectorIds
            : CareerVectors.recommendVectors(state.profile);
          persist();
          wfLog(`Vecteurs: ${state.profile.activeVectors.length} actifs`);
        }

        if (step === "fresh" || step === "fresh_rank") {
          if (step === "fresh") {
            wfLog("Agrégation des sources (ou cache si throttle)…");
            try {
              await fetchFreshJobs();
            } catch (e) {
              wfLog(`Fresh: ${e.message || "partiel"} — on continue avec les offres locales`);
            }
          }
          const ranked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
            maxAgeMs: (state.settings.freshWindowHours || 24) * 3600 * 1000,
          });
          ctx.topJob = ranked[0] || null;
          wfLog(`Classement: ${ranked.length} dans la fenêtre · top: ${ctx.topJob?.title || "—"}`);
        }

        if (step === "best_job") {
          const ranked = CareerAccelerator.rankJobs(state.jobs, state.profile);
          ctx.topJob = ranked[0] || null;
          wfLog(`Meilleure offre levier: ${ctx.topJob?.title || "aucune"}`);
        }

        if (step === "queue_prime") {
          const before = state.applyQueue.length;
          queueAllPrime();
          ctx.queued = Math.max(0, state.applyQueue.length - before);
          if (!ctx.topJob) {
            const ranked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
              maxAgeMs: (state.settings.freshWindowHours || 24) * 3600 * 1000,
            });
            ctx.topJob = ranked[0] || state.jobs[0] || null;
          }
          wfLog(`File: +${ctx.queued} (total ${state.applyQueue.length})`);
        }

        if (step === "cv_orient") {
          const { bridges } = Passerelles.findBridges(state.profile);
          const oriented = Passerelles.orientCv(state.profile, bridges[0]);
          state.cvVersions.unshift({
            id: AscendStore.uid("cv"),
            name: `CV one-click · ${bridges[0]?.title || "cap"}`,
            target: bridges[0]?.title || "upgrade",
            body: `${oriented.orientedHeadline}\n\n${oriented.orientedSummary}`,
            at: Date.now(),
            honest: true,
          });
          persist();
          wfLog("CV orienté sauvé (sans mensonge)");
        }

        if (step === "autofill_top") {
          const jobId = ctx.topJob?.id || state.applyQueue[0]?.jobId;
          if (jobId) {
            if ($("#af-job")) $("#af-job").value = jobId;
            ctx.pack = buildAutofillPack(jobId);
            const j = state.jobs.find((x) => x.id === jobId);
            if (j) j.autofillReady = true;
            persist();
            wfLog(`AutoFill prêt pour ${ctx.topJob?.title || jobId}`);
          } else wfLog("AutoFill: pas d'offre — saute");
        }

        if (step === "cover_top") {
          const job = ctx.topJob || state.jobs.find((j) => j.id === state.applyQueue[0]?.jobId);
          if (job) {
            ensureCoverForJob(job);
            persist();
            wfLog("Lettre générée");
          } else wfLog("Lettre: pas d'offre");
        }

        if (step === "interview_top") {
          const job = ctx.topJob || state.jobs.find((j) => j.id === state.applyQueue[0]?.jobId);
          if (job) {
            ensureInterviewForJob(job);
            selectedJobId = job.id;
            persist();
            wfLog("Prépa entretien générée");
          } else wfLog("Entretien: pas d'offre");
        }

        if (step === "readiness_top") {
          const job = ctx.topJob || state.jobs.find((j) => j.id === state.applyQueue[0]?.jobId);
          if (job) {
            const r = jobContext(job).readiness;
            job.readiness = r.total;
            persist();
            wfLog(`Readiness ${r.total}% — ${r.verdict}`);
          } else wfLog("Readiness: pas d'offre");
        }

        if (step === "batch_prepare") {
          await runBatchOrLoop({ loop: false });
          wfLog("Batch file exécuté");
        }

        if (step === "email_hint") {
          if (ctx.topJob?.company) {
            const guess = EmailFinder.guessDomainFromCompany(ctx.topJob.company);
            if ($("#ef-domain")) $("#ef-domain").value = guess;
            if ($("#ef-job")) $("#ef-job").value = ctx.topJob.id;
            wfLog(`Email Finder préparé · domaine suggéré ${guess}`);
          } else wfLog("Email Finder: ajoute un contact RH manuellement");
        }

        if (step === "passerelles") {
          const { families, bridges } = Passerelles.findBridges(state.profile);
          wfLog(`Familles: ${families.map((f) => f.label).join(", ") || "—"}`);
          wfLog(`Top passerelle: ${bridges[0]?.title || "—"}`);
        }

        if (step === "linkedin") {
          renderLinkedIn();
          wfLog("LinkedIn Boost régénéré — Atelier → LinkedIn pour copier");
        }

        if (step === "summary") {
          wfSetSteps(steps, steps.length);
          const fill = $("#wf-bar-fill");
          if (fill) fill.style.width = "100%";
          wfLog("Terminé.");
          const actions = $("#wf-next-actions");
          if (actions) {
            actions.innerHTML = `
              <button class="btn btn-primary" type="button" data-go="job">Ouvrir fiche offre</button>
              <button class="btn btn-soft" type="button" data-go="apply">Apply Queue</button>
              <button class="btn btn-ghost" type="button" data-go="autofill">AutoFill</button>
              <button class="btn btn-ghost" type="button" data-go="emails">Email Finder</button>`;
          }
        }

        await new Promise((r) => setTimeout(r, 180));
      }
      renderCockpit();
      toast("Workflow terminé");
    } catch (e) {
      wfLog(`Erreur: ${e.message || e}`);
      toast("Workflow interrompu");
    } finally {
      workflowRunning = false;
      if (btn) btn.disabled = false;
      renderCockpit();
    }
  }

  function renderDashboard() {
    const ranked = CareerAccelerator.rankJobs(state.jobs, state.profile);
    const strong = ranked.filter((j) => j.accelerator.score >= (state.settings.minAcceleratorScore || 60));
    const freshRanked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
      maxAgeMs: (state.settings.freshWindowHours || 24) * 3600 * 1000,
    });
    $("#stat-jobs").textContent = String(state.jobs.length);
    $("#stat-accel").textContent = String(strong.length);
    $("#stat-queue").textContent = String(state.applyQueue.length);
    $("#stat-ats").textContent = state._lastAtsScore != null ? `${state._lastAtsScore}%` : "—";

    const list = $("#dash-ranked");
    list.innerHTML = (state.settings.freshFirst ? freshRanked : ranked)
      .slice(0, 6)
      .map((j) => {
        const a = j.accelerator || j.prime?.career;
        const fresh = j.prime?.fresh || FreshRadar.freshnessScore(j);
        return `<article class="job-card">
          <h4>${escapeHtml(j.title)}</h4>
          <div class="meta">${escapeHtml(j.company)} · ${escapeHtml(j.location || "")}</div>
          <div class="score-bar"><span style="width:${a?.score || 0}%"></span></div>
          <span class="chip ${chipClass(a?.tone)}">${a?.score || 0} · ${escapeHtml(a?.label || "")}</span>
          <span class="chip ${chipClass(fresh.tier.tone)}" style="margin-left:0.35rem">${escapeHtml(
            fresh.tier.short
          )} · ${escapeHtml(fresh.ageLabel)}</span>
          ${
            a?.workFit
              ? `<span class="chip ${chipClass(a.workFit.tone)}" style="margin-left:0.35rem">${escapeHtml(
                  a.workFit.arrangement?.label || a.workFit.label
                )}</span>`
              : ""
          }
        </article>`;
      })
      .join("");
  }

  function renderProfile() {
    const p = state.profile;
    $("#pf-name").value = p.fullName || "";
    $("#pf-headline").value = p.headline || "";
    $("#pf-email").value = p.email || "";
    if ($("#pf-phone")) $("#pf-phone").value = p.phone || "";
    $("#pf-location").value = p.location || "";
    renderWorkModes();
    const wp = typeof WorkPrefs !== "undefined" ? WorkPrefs.ensure(p) : p.workPrefs || {};
    if ($("#pf-work-zones")) $("#pf-work-zones").value = (wp.preferredLocations || []).join(", ");
    if ($("#pf-work-exclude")) $("#pf-work-exclude").value = (wp.excludeLocations || []).join(", ");
    if ($("#pf-work-notes")) $("#pf-work-notes").value = wp.notes || "";
    if ($("#pf-website")) $("#pf-website").value = p.website || "";
    if ($("#pf-salary")) $("#pf-salary").value = p.salaryExpectation || "";
    $("#pf-summary").value = p.summary || "";
    $("#pf-skills").value = (p.skills || []).join(", ");
    if ($("#pf-education")) $("#pf-education").value = (p.education || []).join("\n");
    $("#pf-goal").value = p.careerGoal || "";
    $("#pf-linkedin").value = p.linkedinUrl || "";
    $("#pf-current").value = p.currentTrack || "esn";
    $("#pf-target").value = p.targetTrack || "end_client";
    $("#pf-years").value = p.yearsExp ?? 3;
    renderVectorPicker();
  }

  function renderWorkModes() {
    const root = $("#pf-work-modes");
    if (!root || typeof WorkPrefs === "undefined") return;
    const accepted = new Set(WorkPrefs.ensure(state.profile).modes || []);
    root.innerHTML = WorkPrefs.MODES.map((m) => {
      const checked = accepted.has(m.id) ? "checked" : "";
      return `<div class="vector-item">
        <input type="checkbox" id="wm-${m.id}" data-work-mode="${m.id}" ${checked} />
        <label for="wm-${m.id}">${escapeHtml(m.label)}
          <small>${escapeHtml(m.blurb)}</small>
        </label>
      </div>`;
    }).join("");
  }

  function readWorkPrefsFromForm() {
    const modes = $$("#pf-work-modes input[data-work-mode]:checked").map((el) => el.dataset.workMode);
    const preferredLocations = ($("#pf-work-zones")?.value || "")
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const excludeLocations = ($("#pf-work-exclude")?.value || "")
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      modes,
      preferredLocations,
      excludeLocations,
      notes: ($("#pf-work-notes")?.value || "").trim(),
      configured: true,
    };
  }

  async function askWorkPrefsInteractive() {
    if (typeof WorkPrefs === "undefined") return;
    const patch = await WorkPrefs.interactiveConfigure(state.profile);
    if (!patch) {
      toast("Configuration lieu/mode annulée");
      return;
    }
    state.profile = WorkPrefs.applyPatch(state.profile, patch);
    persist();
    renderProfile();
    toast("Préférences lieu / remote enregistrées");
  }

  function renderVectorPicker() {
    const root = $("#pf-vectors");
    if (!root) return;
    const active = new Set(state.profile.activeVectors || []);
    const cats = CareerVectors.CATEGORIES;
    let html = "";
    for (const cat of cats) {
      const items = CareerVectors.VECTORS.filter((v) => v.category === cat.id);
      if (!items.length) continue;
      html += `<div class="vector-cat">${escapeHtml(cat.label)}</div>`;
      for (const v of items) {
        const checked = active.has(v.id) ? "checked" : "";
        html += `<div class="vector-item">
          <input type="checkbox" id="vec-${v.id}" data-vector="${v.id}" ${checked} />
          <label for="vec-${v.id}">${escapeHtml(v.label)}
            <small>${escapeHtml(v.blurb)}</small>
          </label>
        </div>`;
      }
    }
    root.innerHTML = html;
  }

  function readActiveVectorsFromForm() {
    return $$("#pf-vectors input[data-vector]:checked").map((el) => el.dataset.vector);
  }

  function saveProfileFromForm() {
    state.profile.fullName = $("#pf-name").value.trim();
    state.profile.headline = $("#pf-headline").value.trim();
    state.profile.email = $("#pf-email").value.trim();
    if ($("#pf-phone")) state.profile.phone = $("#pf-phone").value.trim();
    state.profile.location = $("#pf-location").value.trim();
    if (typeof WorkPrefs !== "undefined") {
      state.profile.workPrefs = readWorkPrefsFromForm();
    }
    if ($("#pf-website")) state.profile.website = $("#pf-website").value.trim();
    if ($("#pf-salary")) state.profile.salaryExpectation = $("#pf-salary").value.trim();
    state.profile.summary = $("#pf-summary").value.trim();
    state.profile.skills = $("#pf-skills").value
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if ($("#pf-education")) {
      state.profile.education = $("#pf-education").value
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    state.profile.careerGoal = $("#pf-goal").value.trim();
    state.profile.linkedinUrl = $("#pf-linkedin").value.trim();
    state.profile.currentTrack = $("#pf-current").value;
    state.profile.targetTrack = $("#pf-target").value;
    state.profile.yearsExp = Number($("#pf-years").value) || 0;
    state.profile.activeVectors = readActiveVectorsFromForm();
    persist();
    toast("Profil + vecteurs enregistrés");
    render();
  }

  function suggestVectors() {
    const track = $("#pf-current")?.value || state.profile.currentTrack;
    const years = Number($("#pf-years")?.value) || state.profile.yearsExp || 0;
    const target = $("#pf-target")?.value || state.profile.targetTrack;
    state.profile.currentTrack = track;
    state.profile.targetTrack = target;
    state.profile.yearsExp = years;
    // Merge form profile text for detection
    state.profile.headline = $("#pf-headline")?.value.trim() || state.profile.headline;
    state.profile.summary = $("#pf-summary")?.value.trim() || state.profile.summary;
    state.profile.skills = ($("#pf-skills")?.value || "")
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const smart = Passerelles.suggestVectorsFromProfile(state.profile);
    state.profile.activeVectors = smart.vectorIds.length
      ? smart.vectorIds
      : CareerVectors.recommendVectors(state.profile);
    persist();
    renderVectorPicker();
    toast(`${state.profile.activeVectors.length} vecteurs — familles: ${smart.families.map((f) => f.label).join(", ") || "générique"}`);
  }

  function renderPasserelles() {
    if (!$("#pass-families")) return;
    const { families, bridges } = Passerelles.findBridges(state.profile);

    $("#pass-families").innerHTML = families.length
      ? families
          .map(
            (f) =>
              `<span class="chip chip-lime" style="margin:0.2rem">${escapeHtml(f.label)}${
                f.inferred ? " (inféré)" : ""
              }</span>`
          )
          .join(" ")
      : `<p style="color:var(--mist)">Importe ton LinkedIn pour une détection fine.</p>`;

    $("#pass-bridges").innerHTML = bridges
      .slice(0, 8)
      .map(
        (b) => `<article class="job-card">
          <h4>${escapeHtml(b.title)}</h4>
          <div class="meta">Levier ${escapeHtml(b.leverage)} · Paie ${escapeHtml(b.payLift)}</div>
          <p style="color:var(--mist);font-size:0.85rem;margin:0.4rem 0">${escapeHtml(b.cvAngle)}</p>
          <div class="playbook-note">${escapeHtml(b.breakChance)}</div>
        </article>`
      )
      .join("");

    const sel = $("#pass-bridge-select");
    if (sel) {
      sel.innerHTML = bridges
        .slice(0, 12)
        .map((b, i) => `<option value="${i}">${escapeHtml(b.title)}</option>`)
        .join("");
    }

    $("#pass-breaks").innerHTML = Passerelles.BREAKS.map(
      (br) => `<div class="job-card">
        <h4>${escapeHtml(br.label)}</h4>
        <div class="meta">Accel. rémunération : ${escapeHtml(br.payAccel)}</div>
        <p style="color:var(--mist);font-size:0.85rem">${escapeHtml(br.why)}</p>
      </div>`
    ).join("");
  }

  function orientCvFromPasserelle() {
    const { bridges } = Passerelles.findBridges(state.profile);
    const idx = Number($("#pass-bridge-select")?.value || 0);
    const bridge = bridges[idx] || bridges[0];
    if (!bridge) {
      toast("Aucune passerelle — enrichis ton profil LinkedIn");
      return;
    }
    const oriented = Passerelles.orientCv(state.profile, bridge);
    $("#pass-cv-headline").value = oriented.orientedHeadline;
    $("#pass-cv-body").value = [oriented.orientedSummary, "", "Bullets modèles:", ...oriented.bulletTemplates].join(
      "\n"
    );
    $("#pass-honesty").textContent = oriented.honestyBadge;
    $("#pass-cv-rules").innerHTML = oriented.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    state._lastOriented = { oriented, bridge };
    toast("CV orienté — sans invention de faits");
  }

  function saveOrientedCv() {
    const body = $("#pass-cv-body")?.value || "";
    const headline = $("#pass-cv-headline")?.value || "";
    const target = state._lastOriented?.bridge?.title || "Passerelle";
    state.cvVersions.unshift({
      id: AscendStore.uid("cv"),
      name: `CV orienté · ${target}`,
      target,
      body: `${headline}\n\n${body}`,
      at: Date.now(),
      honest: true,
    });
    persist();
    renderCvStudio();
    toast("Sauvé dans CV Studio");
  }

  function applyPasserelleVectors() {
    const smart = Passerelles.suggestVectorsFromProfile(state.profile);
    state.profile.activeVectors = smart.vectorIds;
    persist();
    renderVectorPicker();
    toast("Vecteurs activés selon passerelles détectées");
  }

  function renderAccelerator() {
    const legend = $("#accel-vector-legend");
    if (legend) {
      const active = state.profile.activeVectors || [];
      legend.innerHTML = active.length
        ? active
            .map((id) => {
              const v = CareerVectors.byId(id);
              return v ? `<span class="chip chip-lime">${escapeHtml(v.short || v.label)}</span>` : "";
            })
            .join("")
        : `<span class="chip chip-warn">Aucun vecteur — configure-les dans Profil</span>`;
    }

    const ranked = CareerAccelerator.rankJobs(state.jobs, state.profile);
    const root = $("#accel-list");
    root.innerHTML = ranked
      .map((j) => {
        const a = j.accelerator;
        const bars = (a.vectors || [])
          .slice(0, 6)
          .map(
            (v) => `<div class="vector-bar-row">
              <span class="name">${escapeHtml(v.short || v.label)}</span>
              <div class="score-bar"><span style="width:${v.score}%"></span></div>
              <strong>${v.score}</strong>
            </div>`
          )
          .join("");
        const topPlaybook = (a.vectors || []).find((v) => v.score >= 55)?.playbook || "";
        return `<article class="panel" style="margin-bottom:0.75rem">
          <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:start">
            <div>
              <h3 style="margin:0 0 0.35rem">${escapeHtml(j.title)}</h3>
              <div class="meta" style="color:var(--mist)">${escapeHtml(j.company)} · employeur: <strong>${escapeHtml(
          a.employerType
        )}</strong></div>
            </div>
            <span class="chip ${chipClass(a.tone)}">${a.score} · ${escapeHtml(a.label)}</span>
          </div>
          <div class="score-bar"><span style="width:${a.score}%"></span></div>
          <div class="vector-bars">${bars}</div>
          <ul class="list-gaps">${a.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
          ${topPlaybook ? `<div class="playbook-note">${escapeHtml(topPlaybook)}</div>` : ""}
          ${
            a.passerelle?.bridge
              ? `<div class="playbook-note">Passerelle : ${escapeHtml(a.passerelle.bridge.title)} · Angle CV : ${escapeHtml(
                  a.passerelle.bridge.cvAngle
                )}</div>`
              : ""
          }
          <div class="row-actions">
            <button class="btn btn-primary" data-act="open" data-id="${j.id}">Fiche intelligente</button>
            <button class="btn btn-soft" data-act="queue" data-id="${j.id}">Ajouter à Apply Queue</button>
            <button class="btn btn-ghost" data-act="status" data-id="${j.id}" data-status="applied">Marquer Applied</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function runAts() {
    const jobText = $("#ats-job").value;
    const resume = $("#ats-resume").value || profileResumeText();
    const result = AtsEngine.analyze(resume, jobText);
    state._lastAtsScore = result.score;
    persist();
    $("#ats-score").textContent = `${result.score}%`;
    $("#ats-label").className = `chip ${chipClass(result.tone)}`;
    $("#ats-label").textContent = result.label;
    $("#ats-matched").textContent = result.matched.join(", ") || "—";
    $("#ats-gaps").innerHTML = result.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("") || "<li>Aucun gap majeur</li>";
    $("#ats-rewrite").value = AtsEngine.suggestRewrite(state.profile.summary, result.gaps);
    toast(`ATS score ${result.score}%`);
  }

  function fillDocJobSelects() {
    const opts =
      `<option value="">— profil seul —</option>` +
      state.jobs
        .map((j) => `<option value="${j.id}">${escapeHtml(j.title)} · ${escapeHtml(j.company)}</option>`)
        .join("");
    for (const id of ["cv-job", "letter-job", "mem-job"]) {
      const el = $(`#${id}`);
      if (!el) continue;
      const prev = el.value;
      el.innerHTML = opts;
      if (prev) el.value = prev;
    }
  }

  function renderCvStudio() {
    fillDocJobSelects();
    const versions = state.cvVersions || [];
    $("#cv-list").innerHTML =
      versions
        .map(
          (v) => `<article class="job-card">
        <h4>${escapeHtml(v.name)}</h4>
        <div class="meta">${new Date(v.at).toLocaleString()} · ${escapeHtml(v.target || "")}</div>
        <p style="color:var(--mist);font-size:0.9rem;white-space:pre-wrap">${escapeHtml((v.body || "").slice(0, 280))}…</p>
        <button class="btn btn-ghost btn-tiny" type="button" data-load-cv="${v.id}">Réouvrir</button>
      </article>`
        )
        .join("") || `<p style="color:var(--mist)">Aucune version. Génère un CV par offre.</p>`;

    $$("#cv-list [data-load-cv]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = state.cvVersions.find((x) => x.id === btn.dataset.loadCv);
        if (!v) return;
        if ($("#cv-preview")) $("#cv-preview").value = v.body;
        state._lastCvHtml = v.html || null;
        toast("Version rechargée");
      });
    });

    renderApplyMemory();
  }

  function renderApplyMemory() {
    const root = $("#mem-list");
    if (!root) return;
    const list = state.applyMemory || [];
    root.innerHTML =
      list
        .slice(0, 12)
        .map(
          (m) => `<div class="job-card" style="margin-bottom:0.4rem">
          <div class="meta">${escapeHtml(m.outcome)} · ${escapeHtml(m.company || m.role || "—")} · ${new Date(m.at).toLocaleDateString()}</div>
          <div style="font-size:0.88rem">${escapeHtml(m.lesson || m.note || "")}</div>
        </div>`
        )
        .join("") || `<p style="color:var(--mist);font-size:0.85rem">Aucun retour encore.</p>`;
  }

  function tailorCvFromUi() {
    const jobId = $("#cv-job")?.value;
    let job = state.jobs.find((j) => j.id === jobId);
    if (!job && $("#cv-target")?.value.trim()) {
      job = {
        id: null,
        title: $("#cv-target").value.trim(),
        company: "",
        description: $("#cv-target").value.trim(),
        location: state.profile.location || "",
      };
    }
    if (!job) {
      toast("Choisis une offre ou une cible");
      return;
    }
    const cv = job.id
      ? ensureCvForJob(job)
      : (core()?.docs?.cv?.({
          profile: state.profile,
          job,
          bridge: Passerelles.findBridges(state.profile).bridges[0] || null,
          memory: ApplyMemory.lessonsRelevant(state, job),
        }) ||
        CvTailor.generate({
          profile: state.profile,
          job,
          bridge: Passerelles.findBridges(state.profile).bridges[0] || null,
          memory: ApplyMemory.lessonsRelevant(state, job),
        }));
    if (!job.id) {
      state.cvVersions.unshift(cv);
      state.cvVersions = state.cvVersions.slice(0, 40);
    }
    $("#cv-preview").value = cv.body;
    state._lastCvHtml = cv.html;
    if ($("#cv-honesty")) {
      $("#cv-honesty").innerHTML = (cv.honesty || []).map((h) => `<li>${escapeHtml(h)}</li>`).join("");
    }
    persist();
    renderCvStudio();
    toast(`CV généré (${cv.path || "local"}) — corrige si besoin puis PDF`);
  }

  function reviseCvNl() {
    const text = $("#cv-preview")?.value || "";
    const instruction = $("#cv-nl")?.value || "";
    const out = DocRevise.applyInstruction(text, instruction, state.profile);
    $("#cv-preview").value = out.text;
    if ($("#cv-issues")) {
      $("#cv-issues").innerHTML = [
        ...out.notes.map((n) => `<li>${escapeHtml(n)}</li>`),
        ...out.issues.map((i) => `<li class="chip-${i.level}">${escapeHtml(i.msg)}</li>`),
      ].join("");
    }
    state._lastCvHtml = null;
    toast("Correction appliquée");
  }

  function scanCvIssues() {
    const issues = DocRevise.detectInconsistencies($("#cv-preview")?.value || "", state.profile);
    if ($("#cv-issues")) {
      $("#cv-issues").innerHTML = issues.length
        ? issues.map((i) => `<li>${escapeHtml(i.msg)}</li>`).join("")
        : `<li>Aucune incohérence évidente.</li>`;
    }
  }

  function printCvPdf() {
    const body = $("#cv-preview")?.value || "";
    if (!body.trim()) {
      toast("Génère ou colle un CV d’abord");
      return;
    }
    const html =
      state._lastCvHtml ||
      CvTailor.toPrintHtml({
        facts: CvTailor.factsFromProfile(state.profile),
        headline: state.profile.headline || "",
        summary: body.slice(0, 800),
        skillLine: (state.profile.skills || []).join(" · "),
        expBlock: body,
        edu: (state.profile.education || []).join("\n"),
        company: "",
        target: $("#cv-target")?.value || "",
        work: typeof WorkPrefs !== "undefined" ? WorkPrefs.summaryText(state.profile) : "",
      });
    // Prefer live edited body in a simple print wrapper
    const live = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>CV</title>
      <style>@page{margin:16mm}body{font-family:Georgia,serif;white-space:pre-wrap;line-height:1.35;max-width:720px;margin:0 auto;padding:20px;font-size:11pt}</style>
      </head><body>${escapeHtml(body).replace(/\n/g, "<br/>")}</body></html>`;
    CvTailor.openPrint(live || html);
  }

  function generateLetterFromUi() {
    const job = state.jobs.find((j) => j.id === $("#letter-job")?.value);
    if (!job) {
      toast("Choisis une offre pour la lettre");
      return;
    }
    const letter = ensureCoverForJob(job);
    if ($("#letter-preview")) $("#letter-preview").value = letter.body;
    persist();
    toast("Lettre générée");
  }

  function reviseLetterNl() {
    const out = DocRevise.applyInstruction(
      $("#letter-preview")?.value || "",
      $("#letter-nl")?.value || "",
      state.profile
    );
    $("#letter-preview").value = out.text;
    toast(out.notes[0] || "OK");
  }

  function addApplyMemoryFromUi() {
    const job = state.jobs.find((j) => j.id === $("#mem-job")?.value);
    ApplyMemory.add(state, {
      jobId: job?.id || null,
      company: job?.company || "",
      role: job?.title || "",
      outcome: $("#mem-outcome")?.value || "note",
      lesson: $("#mem-lesson")?.value || "",
      emailSnippet: $("#mem-email")?.value || "",
      note: $("#mem-lesson")?.value || "",
    });
    if ($("#mem-lesson")) $("#mem-lesson").value = "";
    if ($("#mem-email")) $("#mem-email").value = "";
    persist();
    renderApplyMemory();
    toast("Retour enregistré (local)");
  }

  function refreshAuthStatus() {
    const el = $("#auth-status");
    if (!el || typeof AscendAuth === "undefined") return;
    const st = AscendAuth.status();
    el.textContent = st.requireAuth
      ? `Login ON · ${st.hasPassword ? "mdp" : "oauth"} · ${st.hasJwt ? "JWT actif" : "verrouillé"}${st.sealed ? " · données scellées" : ""}`
      : "Login OFF (données appareil en clair local)";
  }

  async function showAuthGateIfNeeded() {
    if (typeof AscendAuth === "undefined" || !AscendAuth.isEnabled()) {
      $("#auth-gate")?.setAttribute("hidden", "");
      return false;
    }
    const valid = await AscendAuth.sessionValid();
    if (valid.ok) {
      $("#auth-gate")?.setAttribute("hidden", "");
      return false;
    }
    $("#auth-gate")?.removeAttribute("hidden");
    return true;
  }

  async function gateLoginPassword() {
    const pass = $("#gate-pass")?.value || "";
    const err = $("#gate-err");
    try {
      await AscendAuth.loginPassword(pass);
      state = AscendStore.load();
      ensureSeed();
      $("#auth-gate")?.setAttribute("hidden", "");
      if (err) err.hidden = true;
      render();
      refreshAuthStatus();
      toast("Session déverrouillée · JWT local");
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = e.message || "Échec";
      }
    }
  }

  function boostCv() {
    const target = $("#cv-target").value.trim() || "Upgrade de carrière";
    const { bridges } = Passerelles.findBridges(state.profile);
    const bridge =
      bridges.find((b) => normalizeIncludes(target, b.title) || normalizeIncludes(target, b.to)) || bridges[0];
    const oriented = Passerelles.orientCv(state.profile, bridge);
    const gaps = ($("#ats-gaps") ? [...$("#ats-gaps").querySelectorAll("li")].map((li) => li.textContent) : []).filter(
      (t) => t && t !== "Aucun gap majeur" && t !== "—"
    );
    const body = [
      state.profile.fullName,
      oriented.orientedHeadline,
      "",
      oriented.orientedSummary,
      "",
      gaps.length ? "Mots ATS à intégrer HONNÊTEMENT (uniquement si vrais) : " + gaps.slice(0, 10).join(", ") : "",
      "",
      "Règles anti-mensonge :",
      ...oriented.rules.map((r) => `- ${r}`),
      "",
      `Version ciblée: ${target}`,
    ]
      .filter(Boolean)
      .join("\n");
    state.cvVersions.unshift({
      id: AscendStore.uid("cv"),
      name: `CV · ${target}`,
      target,
      body,
      at: Date.now(),
      honest: true,
    });
    persist();
    $("#cv-preview").value = body;
    renderCvStudio();
    toast("CV orienté sans invention de faits");
  }

  function normalizeIncludes(hay, needle) {
    const h = String(hay || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const n = String(needle || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    return n && h.includes(n);
  }

  function renderLinkedIn() {
    const p = state.profile;
    const active = (p.activeVectors || [])
      .map((id) => CareerVectors.byId(id)?.short)
      .filter(Boolean)
      .slice(0, 4);
    const vectorLine = active.length ? active.join(" · ") : "upgrade de carrière";
    const headline = `${p.headline || "Professionnel"} | Cap : ${vectorLine}`;
    const about = `Je construis avec un biais résultat et ownership.\n\nParcours actuel: ${p.currentTrack || "—"}.\nObjectif: ${p.careerGoal || "un meilleur job — upgrade réel, pas un lateral move"}.\n\nVecteurs que je priorise: ${(p.activeVectors || [])
      .map((id) => CareerVectors.byId(id)?.label)
      .filter(Boolean)
      .slice(0, 6)
      .join("; ") || "à définir dans AscendOS"}.\n\nForces: ${(p.skills || []).slice(0, 8).join(", ") || "à compléter"}.\n\nOuvert aux échanges sur des rôles qui montent vraiment (scope, capital compétences, plateforme suivante).`;
    $("#li-headline").value = headline.slice(0, 220);
    $("#li-about").value = about;
  }

  function renderPipeline() {
    const cols = ["saved", "applied", "interview", "offer", "rejected"];
    const labels = {
      saved: "Saved",
      applied: "Applied",
      interview: "Interview",
      offer: "Offer",
      rejected: "Rejected",
    };
    const root = $("#kanban");
    root.innerHTML = cols
      .map((status) => {
        const cards = state.jobs.filter((j) => j.status === status);
        return `<div class="kanban-col" data-status="${status}">
          <h3>${labels[status]} (${cards.length})</h3>
          ${cards
            .map((j) => {
              const a = CareerAccelerator.scoreJob(j, state.profile);
              return `<div class="job-card" draggable="true" data-id="${j.id}">
                <h4>${escapeHtml(j.title)}</h4>
                <div class="meta">${escapeHtml(j.company)}</div>
                <span class="chip ${chipClass(a.tone)}">${a.score}</span>
                <button class="btn btn-ghost btn-tiny" type="button" data-act="open" data-id="${j.id}">Fiche</button>
              </div>`;
            })
            .join("")}
        </div>`;
      })
      .join("");

    $$(".job-card[draggable]", root).forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.id);
      });
    });
    $$(".kanban-col", root).forEach((col) => {
      col.addEventListener("dragover", (e) => e.preventDefault());
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const job = state.jobs.find((j) => j.id === id);
        if (!job) return;
        job.status = col.dataset.status;
        if (col.dataset.status === "interview") ensureInterviewForJob(job);
        if (col.dataset.status === "applied") WeeklyPlan.log("apply", { jobId: job.id });
        persist();
        renderPipeline();
        toast(`Déplacé → ${col.dataset.status}`);
      });
    });
    root.querySelectorAll("button[data-act=open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openJob(btn.dataset.id);
      });
    });
  }

  function renderApplyQueue() {
    const root = $("#apply-list");
    if (!state.applyQueue.length) {
      root.innerHTML = `<p style="color:var(--mist)">File vide. Depuis Accélérateur, ajoute les offres à fort levier.</p>`;
      return;
    }
    root.innerHTML = state.applyQueue
      .map((item) => {
        const job = state.jobs.find((j) => j.id === item.jobId);
        if (!job) return "";
        const a = CareerAccelerator.scoreJob(job, state.profile);
        const prime = FreshRadar.primeApplyScore(job, state.profile);
        const contacts = (state.contacts || []).filter((c) => c.jobId === job.id);
        const contactBlock = contacts.length
          ? `<div style="margin-top:0.75rem">
              <div style="color:var(--mist);font-size:0.85rem;margin-bottom:0.4rem">Mails directs (en plus du CRM ATS)</div>
              ${contacts
                .map((c) => {
                  const top = (c.candidates || []).find((x) => x.preferred) || (c.candidates || [])[0];
                  return `<div class="job-card" style="margin-bottom:0.4rem">
                    <h4>${escapeHtml(c.fullName)} · ${escapeHtml(EmailFinder.roleLabel(c.role))}</h4>
                    <div class="meta">${escapeHtml(top?.email || "—")} · conf. ${top?.confidence ?? "—"}%</div>
                    <div class="row-actions">
                      <button class="btn btn-soft" data-act="mail-contact" data-qid="${item.id}" data-cid="${c.id}" type="button">Mail dual CRM+direct</button>
                    </div>
                  </div>`;
                })
                .join("")}
            </div>`
          : `<p style="color:var(--mist);font-size:0.85rem;margin-top:0.6rem">Pas encore de contact RH/CP — utilise <strong>Email Finder</strong>.</p>`;

        return `<article class="panel" style="margin-bottom:0.75rem">
          <h3>${escapeHtml(job.title)} · ${escapeHtml(job.company)}</h3>
          <span class="chip ${chipClass(a.tone)}">Carrière ${a.score}</span>
          <span class="chip ${chipClass(prime.fresh.tier.tone)}" style="margin-left:0.35rem">${escapeHtml(
            prime.fresh.tier.short
          )} · ${escapeHtml(prime.fresh.ageLabel)}</span>
          ${(() => {
            const r = jobContext(job).readiness;
            return `<span class="chip ${chipClass(r.tone)}" style="margin-left:0.35rem">Ready ${r.total}%</span>`;
          })()}
          ${pathChip("local", "AscendCore — local first")}
          ${
            state.connectors?.gmailClientId || state.connectors?.gmailConnected
              ? pathChip("upgrade", "Gmail OAuth disponible")
              : ""
          }
          ${
            typeof AscendResilience !== "undefined" &&
            AscendResilience.statusReport().some((h) => h.cooling)
              ? pathChip("cooldown", "Hôte en circuit breaker")
              : ""
          }
          ${
            prime.urgency === "apply_now"
              ? `<span class="chip chip-ok" style="margin-left:0.35rem">APPLY NOW</span>`
              : ""
          }
          <div class="row-actions" style="margin-top:0.55rem">
            <button class="btn btn-soft" type="button" data-act="open-job" data-id="${job.id}">Fiche intelligente</button>
          </div>
          <div class="field" style="margin-top:0.75rem">
            <label>Réponse formulaires ATS / CRM (éditable)</label>
            <textarea data-qid="${item.id}" class="apply-answer">${escapeHtml(item.answer || "")}</textarea>
          </div>
          ${contactBlock}
          <div class="row-actions">
            <button class="btn btn-primary" data-act="mailto" data-qid="${item.id}">Envoyer via Gmail</button>
            <button class="btn btn-soft" data-act="autofill" data-qid="${item.id}">Pack AutoFill CRM</button>
            <button class="btn btn-ghost" data-act="done" data-qid="${item.id}">Marquer envoyé</button>
            <button class="btn btn-danger" data-act="drop" data-qid="${item.id}">Retirer</button>
          </div>
        </article>`;
      })
      .join("");
  }

  let lastFillPack = null;
  let lastEmailCandidates = [];

  function renderAutofill() {
    if (!$("#af-portal")) return;
    const jobSel = $("#af-job");
    const prev = jobSel?.value;
    if (jobSel) {
      jobSel.innerHTML =
        `<option value="">— profil seul —</option>` +
        state.jobs
          .map((j) => `<option value="${j.id}">${escapeHtml(j.title)} · ${escapeHtml(j.company)}</option>`)
          .join("");
      if (prev) jobSel.value = prev;
    }
    const portalSel = $("#af-portal");
    if (portalSel && !portalSel.options.length) {
      portalSel.innerHTML = AutoFill.PORTALS.map(
        (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
      ).join("");
    } else if (portalSel && portalSel.options.length === 0) {
      portalSel.innerHTML = AutoFill.PORTALS.map(
        (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
      ).join("");
    }
    // Always refresh portal list once
    if (portalSel && portalSel.dataset.ready !== "1") {
      portalSel.innerHTML = AutoFill.PORTALS.map(
        (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
      ).join("");
      portalSel.dataset.ready = "1";
    }

    $("#af-portals").innerHTML = AutoFill.PORTALS.filter((p) => p.id !== "generic")
      .map(
        (p) => `<article class="feature" style="min-height:auto;padding:0.85rem">
          <h3 style="font-size:1rem">${escapeHtml(p.label)}</h3>
          <p>${escapeHtml(p.notes)}</p>
        </article>`
      )
      .join("");

    if (lastFillPack) {
      $("#af-preview").textContent = AutoFill.exportJson(lastFillPack);
      const portalId = $("#af-portal")?.value || "generic";
      $("#af-checklist").innerHTML =
        `<ul class="list-gaps">` +
        AutoFill.portalChecklist(portalId, lastFillPack)
          .map((c) => `<li>${escapeHtml(c)}</li>`)
          .join("") +
        `</ul>`;
      const bm = $("#af-bookmarklet");
      if (bm) {
        bm.href = AutoFill.buildBookmarklet(lastFillPack);
        bm.onclick = (e) => {
          e.preventDefault();
          toast("Glisse ce bouton dans tes favoris, puis clique-le sur la page ATS");
        };
      }
    } else {
      $("#af-preview").textContent =
        "Clique « Générer pack AutoFill » — profil + vault IA fusionnés.";
    }

    const gaps = PublicEnrich.missingForAutofill(state.profile);
    if ($("#af-gaps")) {
      $("#af-gaps").innerHTML = gaps.length
        ? `<span class="chip chip-warn">${gaps.length} gap(s)</span> ` +
          gaps.map((g) => `<span class="chip chip-info">${escapeHtml(g.label)}</span>`).join(" ")
        : `<span class="chip chip-ok">Profil prêt pour AutoFill</span>`;
    }
    if ($("#enrich-links")) {
      $("#enrich-links").innerHTML = PublicEnrich.publicSourceLinks(state.profile)
        .map(
          (s) =>
            `<a class="chip chip-lime" href="${escapeHtml(s.href)}" target="_blank" rel="noopener" title="${escapeHtml(
              s.blurb
            )}">${escapeHtml(s.label)}</a>`
        )
        .join("");
    }
  }

  async function askProfileGapsInteractive(fields) {
    const list = fields || PublicEnrich.missingForAutofill(state.profile);
    if (
      typeof WorkPrefs !== "undefined" &&
      !WorkPrefs.ensure(state.profile).configured
    ) {
      await askWorkPrefsInteractive();
    }
    if (!list.length) {
      toast("Aucun gap critique");
      return {};
    }
    const patch = await PublicEnrich.interactiveFill(state.profile, {
      fields: list,
      askFn: async (question, prev) => window.prompt(question, prev || "") || "",
    });
    if (Object.keys(patch).length) {
      state.profile = PublicEnrich.applyPatch(state.profile, patch);
      persist();
      renderProfile();
      renderAutofill();
      toast(`${Object.keys(patch).length} champ(s) complété(s)`);
    }
    return patch;
  }

  async function runBatchOrLoop({ loop = false } = {}) {
    if (
      typeof WorkPrefs !== "undefined" &&
      !WorkPrefs.ensure(state.profile).configured
    ) {
      await askWorkPrefsInteractive();
    }
    const log = $("#batch-log");
    if (log) log.textContent = "";
    const append = (m) => {
      if (log) log.textContent += (log.textContent ? "\n" : "") + m;
    };
    const helpers = {
      persist,
      ensureCover: (job) => ensureCoverForJob(job),
      ensureInterview: (job) => ensureInterviewForJob(job),
      readiness: (job) => jobContext(job).readiness,
      buildPack: (id) => buildAutofillPack(id),
      ensureCv: (job) => ensureCvForJob(job),
      refreshFresh: fetchFreshJobs,
      prepareOutreach: (job) => prepareOutreachViaCore({ job }),
    };
    const onNeedProfile = async (miss) => askProfileGapsInteractive(miss);
    const onStep = (s) => append(s.message || s.phase);
    try {
      if (loop) {
        const out = await BatchApply.runLoop({
          state,
          helpers,
          onStep,
          onNeedProfile,
          opts: {
            mode: "queue",
            limit: 6,
            rounds: 2,
            pauseMs: 2000,
            pauseBetweenRoundsMs: 1500,
            requireReady: 50,
            openTabs: true,
            interview: false,
          },
        });
        WeeklyPlan.log("apply", { kind: "loop", rounds: out.rounds?.length });
        toast(`Loop Apply terminé · ${out.rounds?.length || 0} tour(s)`);
      } else {
        const jobs = BatchApply.pickJobs(state, { mode: "queue", limit: 10 });
        if (!jobs.length) {
          toast("File vide — ajoute des offres d’abord");
          return;
        }
        const out = await BatchApply.runBatch({
          state,
          jobs,
          helpers,
          onStep,
          onNeedProfile,
          opts: { pauseMs: 2200, requireReady: 50, openTabs: true },
        });
        WeeklyPlan.log("apply", { kind: "batch", n: out.count });
        toast(`Batch · ${out.report.filter((r) => r.status === "prepared").length} pack(s) prêts`);
      }
      persist();
      render();
    } catch (e) {
      append(`Erreur: ${e.message || e}`);
      toast(e.message || "Batch interrompu");
    }
  }

  function buildAutofillPack(jobId) {
    const job = jobId ? state.jobs.find((j) => j.id === jobId) : state.jobs.find((j) => j.id === $("#af-job")?.value);
    const pack = AutoFill.buildFillPack(state.profile, job || null);
    lastFillPack = pack;
    state.lastFillPack = pack;
    persist();
    const portal = AutoFill.detectPortal($("#af-url")?.value || job?.url || "");
    if ($("#af-portal")) $("#af-portal").value = portal.id;
    if ($("#af-status")) {
      $("#af-status").textContent = `Pack prêt · IA vault: ${
        pack.aiProvenance.aiVault ? "oui" : "non"
      } · LinkedIn: ${pack.aiProvenance.linkedin ? "oui" : "non"} · portail: ${portal.label}`;
    }
    renderAutofill();
    toast("Pack AutoFill généré");
    return pack;
  }

  function fillEmailJobSelect() {
    const sel = $("#ef-job");
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML =
      `<option value="">— sans offre —</option>` +
      state.jobs
        .map((j) => `<option value="${j.id}">${escapeHtml(j.title)} · ${escapeHtml(j.company)}</option>`)
        .join("");
    if (prev) sel.value = prev;
  }

  function fillPatternSelect() {
    const sel = $("#ef-pattern");
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Auto (appris ou prenom.nom)</option>` +
      EmailFinder.PATTERNS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  }

  function renderEmailFinder() {
    fillEmailJobSelect();
    fillPatternSelect();

    const tools = $("#ef-free-tools");
    if (tools) {
      tools.innerHTML = (EmailFinder.FREE_TOOLS || [])
        .map((t) =>
          t.url
            ? `<a class="chip chip-info" href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(
                t.label
              )} · ${escapeHtml(t.free)}</a>`
            : `<span class="chip chip-lime">${escapeHtml(t.label)} · ${escapeHtml(t.free)}</span>`
        )
        .join("");
    }

    const learnedRoot = $("#ef-learned");
    if (learnedRoot) {
      const domains = Object.values(state.emailPatterns || {});
      learnedRoot.innerHTML = domains.length
        ? domains
            .map(
              (d) => `<div class="job-card">
            <h4>@${escapeHtml(d.domain)}</h4>
            <div class="meta">Pattern: <strong>${escapeHtml(d.topLabel)}</strong> · conf. ${Math.round(
                (d.confidence || 0) * 100
              )}% · ${d.samples?.length || 0} sample(s)</div>
            <span class="chip chip-lime">${escapeHtml(d.topPattern)}</span>
          </div>`
            )
            .join("")
        : `<p style="color:var(--mist);font-size:0.9rem">Colle emails publics, signatures commerciaux ou vCard.</p>`;
    }

    const candRoot = $("#ef-candidates");
    if (candRoot) {
      if (!lastEmailCandidates.length) {
        candRoot.innerHTML = `<p style="color:var(--mist)">Aucun pour l'instant.</p>`;
      } else {
        candRoot.innerHTML = lastEmailCandidates
          .slice(0, 20)
          .map(
            (c) => `<div class="job-card" style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;align-items:center">
              <div>
                <h4 style="margin:0">${escapeHtml(c.email)}</h4>
                <div class="meta">${escapeHtml(c.patternLabel || c.method || "")}${
              c.roleMailbox ? " · boîte" : ""
            } · conf. ${c.confidence}%${c.method ? ` · ${escapeHtml(c.method)}` : ""}</div>
              </div>
              <div class="row-actions">
                <button class="btn btn-soft" data-act="pick-email" data-email="${escapeHtml(
                  c.email
                )}" type="button">Sauver</button>
                <button class="btn btn-ghost" data-act="mail-guess" data-email="${escapeHtml(
                  c.email
                )}" type="button">Mailto dual</button>
              </div>
            </div>`
          )
          .join("");
      }
    }

    const contactsRoot = $("#ef-contacts");
    if (contactsRoot) {
      const list = state.contacts || [];
      contactsRoot.innerHTML = list.length
        ? list
            .map((c) => {
              const job = state.jobs.find((j) => j.id === c.jobId);
              const top = (c.candidates || []).find((x) => x.preferred) || (c.candidates || [])[0];
              return `<article class="job-card">
                <h4>${escapeHtml(c.fullName)} · ${escapeHtml(EmailFinder.roleLabel(c.role))}</h4>
                <div class="meta">${job ? escapeHtml(job.company + " · " + job.title) : "Sans offre"} · ${escapeHtml(
                c.domain || ""
              )}</div>
                <div class="score-bar"><span style="width:${top?.confidence || 40}%"></span></div>
                <span class="chip chip-ok">${escapeHtml(c.chosenEmail || top?.email || "—")}</span>
                <div class="row-actions" style="margin-top:0.5rem">
                  <button class="btn btn-soft" data-act="mail-saved" data-cid="${c.id}" type="button">Mail dual CRM+direct</button>
                  <button class="btn btn-danger" data-act="drop-contact" data-cid="${c.id}" type="button">Supprimer</button>
                </div>
              </article>`;
            })
            .join("")
        : `<p style="color:var(--mist)">Aucun contact sauvé.</p>`;
    }
  }

  function parseCardToForm() {
    const card = EmailFinder.parseBusinessCard($("#ef-samples")?.value || "");
    const prev = $("#ef-card-preview");
    if (!card.emails.length && !card.fullName) {
      toast("Carte non reconnue — colle nom + email");
      return;
    }
    if (card.fullName && $("#ef-fullname")) $("#ef-fullname").value = card.fullName;
    if (card.title && $("#ef-title")) $("#ef-title").value = card.title;
    if (card.domain && $("#ef-domain")) $("#ef-domain").value = card.domain;
    if (card.title && $("#ef-role")) {
      const role = EmailFinder.detectRole(card.title);
      if (role !== "contact") $("#ef-role").value = role;
    }
    // Learn pattern from card email + name
    if (card.emails.length) {
      const learned = EmailFinder.learnFromPublicSamples(
        card.fullName ? `${card.fullName} <${card.emails[0]}>` : card.emails[0]
      );
      state.emailPatterns = { ...(state.emailPatterns || {}), ...learned };
      persist();
    }
    if (prev) {
      prev.innerHTML = `<div class="playbook-note">Carte (${escapeHtml(card.source)}) :
        <strong>${escapeHtml(card.fullName || "—")}</strong> · ${escapeHtml(card.title || "—")} ·
        ${escapeHtml(card.company || "—")} · ${escapeHtml(card.emails[0] || "—")} ·
        domaine <code>${escapeHtml(card.domain || "—")}</code></div>`;
    }
    renderEmailFinder();
    toast("Carte parsée → formulaire");
  }

  async function checkMx() {
    const domain = EmailFinder.normalizeDomain($("#ef-domain")?.value || "");
    const el = $("#ef-mx-status");
    if (!domain) {
      toast("Domaine requis");
      return;
    }
    if (el) el.textContent = `MX check ${domain}…`;
    const r = await (core()?.email?.checkMx?.(domain) || EmailFinder.checkDomainMx(domain));
    if (el) {
      el.textContent = r.ok
        ? `MX OK pour ${domain} (${(r.mx || []).slice(0, 2).join(", ") || "records"}) — domaine accepte le mail`
        : `Pas de MX clair pour ${domain}${r.error ? " · " + r.error : ""} — vérifie le domaine`;
    }
    toast(r.ok ? `MX OK (${r.path || "local"})` : `MX manquant / douteux (${r.path || "degraded"})`);
  }

  async function optionalApiEnrich() {
    const domain = EmailFinder.normalizeDomain($("#ef-domain")?.value || "");
    const fullName = $("#ef-fullname")?.value.trim() || "";
    if (!domain || !fullName) {
      toast("Domaine + nom requis");
      return;
    }
    // Sync form keys into connectors for this call (no save required)
    const connectors = {
      ...state.connectors,
      hunterApiKey: state.connectors.hunterApiKey || $("#hunter-api-key")?.value.trim() || "",
      underIaApiKey: state.connectors.underIaApiKey || $("#under-ia-key")?.value.trim() || "",
      underIaApiBase: state.connectors.underIaApiBase || $("#under-ia-base")?.value.trim() || "",
    };
    const resolve = core()?.email?.resolve || core()?.resolveEmails;
    if (!resolve) {
      toast("AscendCore indisponible");
      return;
    }
    const out = await resolve({
      domain,
      fullName,
      connectors,
      learned: state.emailPatterns,
      preferApis: true,
    });
    if (out.patternPatch) {
      state.emailPatterns = state.emailPatterns || {};
      state.emailPatterns[out.patternPatch.domain] = out.patternPatch;
      persist();
    }
    lastEmailCandidates = out.candidates;
    renderEmailFinder();
    const hint = (out.notes || []).slice(0, 2).join(" · ");
    toast(
      out.enriched
        ? `Enrichi (${out.path}): ${out.enriched.email}`
        : `Local · ${out.candidates.length} candidats${hint ? " — " + hint : ""}`
    );
  }

  function exportEmailCandidates(kind) {
    const list = lastEmailCandidates || [];
    if (!list.length && kind !== "patterns") {
      toast("Lance d’abord le permutator");
      return;
    }
    const domain = EmailFinder.normalizeDomain($("#ef-domain")?.value || "") || "export";
    const name = ($("#ef-fullname")?.value || "contact").replace(/\s+/g, "_");
    if (kind === "csv") {
      EmailFinder.downloadText(
        `ascendos-permutator-${name}-${domain}.csv`,
        EmailFinder.exportCandidatesCsv(list),
        "text/csv"
      );
      toast("CSV exporté");
    } else if (kind === "json") {
      EmailFinder.downloadText(
        `ascendos-permutator-${name}-${domain}.json`,
        EmailFinder.exportCandidatesJson(list, { domain, fullName: $("#ef-fullname")?.value || "" }),
        "application/json"
      );
      toast("JSON complet exporté");
    } else if (kind === "patterns") {
      EmailFinder.downloadText(
        "ascendos-email-patterns.json",
        JSON.stringify({ patterns: EmailFinder.listAllPatterns() }, null, 2),
        "application/json"
      );
      toast("Catalogue patterns exporté");
    } else if (kind === "copy") {
      navigator.clipboard.writeText(list.map((c) => c.email).join("\n"));
      toast(`${list.length} emails copiés`);
    }
  }

  function learnEmailPatterns() {
    const paste = $("#ef-samples")?.value || "";
    const learned = EmailFinder.learnFromPublicSamples(paste);
    const count = Object.keys(learned).length;
    if (!count) {
      toast("Aucun email détecté dans le collage");
      return;
    }
    state.emailPatterns = { ...(state.emailPatterns || {}), ...learned };
    // Prefill domain from first learned
    const firstDomain = Object.keys(learned)[0];
    if (firstDomain && $("#ef-domain")) $("#ef-domain").value = firstDomain;
    persist();
    renderEmailFinder();
    toast(`${count} domaine(s) — nomenclature apprise`);
  }

  function guessDomainForJob() {
    const jobId = $("#ef-job")?.value;
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) {
      toast("Choisis une offre d'abord");
      return;
    }
    // Prefer domain already on job, else from learned patterns matching company slug, else guess
    if (job.domain) {
      $("#ef-domain").value = job.domain;
      toast("Domaine de l'offre");
      return;
    }
    const guess = EmailFinder.guessDomainFromCompany(job.company);
    const alts = EmailFinder.guessDomainsFromCompany(job.company).join(", ");
    $("#ef-domain").value = guess;
    toast(`Suggestion ${guess} (alts: ${alts})`);
  }

  function runEmailGuess() {
    const domain = EmailFinder.normalizeDomain($("#ef-domain")?.value || "");
    const fullName = $("#ef-fullname")?.value.trim() || "";
    const title = $("#ef-title")?.value.trim() || "";
    const patternId = $("#ef-pattern")?.value || "";
    if (!domain || !fullName) {
      toast("Domaine + nom LinkedIn requis");
      return;
    }
    lastEmailCandidates = EmailFinder.generateCandidates({
      fullName,
      domain,
      preferredPatternId: patternId || undefined,
      learned: state.emailPatterns,
    });
    renderEmailFinder();
    toast(`${lastEmailCandidates.length} candidats générés`);
  }

  function saveContactWithEmail(email) {
    const jobId = $("#ef-job")?.value || "";
    const fullName = $("#ef-fullname")?.value.trim() || "";
    const title = $("#ef-title")?.value.trim() || "";
    let role = $("#ef-role")?.value || "auto";
    if (role === "auto") role = EmailFinder.detectRole(title);
    const domain = EmailFinder.normalizeDomain($("#ef-domain")?.value || "");
    if (!fullName || !email) {
      toast("Nom + email requis");
      return;
    }
    const candidates = lastEmailCandidates.length
      ? lastEmailCandidates
      : EmailFinder.generateCandidates({
          fullName,
          domain,
          learned: state.emailPatterns,
        });
    // Mark chosen as preferred
    const marked = candidates.map((c) => ({
      ...c,
      preferred: c.email === email,
    }));

    state.contacts = state.contacts || [];
    state.contacts.unshift({
      id: AscendStore.uid("ct"),
      jobId: jobId || null,
      fullName,
      title,
      role,
      domain,
      candidates: marked,
      chosenEmail: email,
      at: Date.now(),
    });

    if (jobId) {
      const job = state.jobs.find((j) => j.id === jobId);
      if (job) job.domain = domain;
    }

    persist();
    renderEmailFinder();
    renderApplyQueue();
    toast("Contact sauvé — utilisable dans Apply Queue");
  }

  async function dualMailContact(contact, preferredEmail) {
    const job = state.jobs.find((j) => j.id === contact.jobId) || {
      title: contact.title,
      company: contact.domain,
    };
    const email =
      preferredEmail ||
      contact.chosenEmail ||
      (contact.candidates || []).find((c) => c.preferred)?.email ||
      (contact.candidates || [])[0]?.email;
    if (!email) {
      toast("Aucun email candidat");
      return;
    }
    const draft = prepareOutreachViaCore({ job, contact, email });
    const result = await sendViaCore({
      to: draft.to || email,
      subject: draft.subject,
      body: draft.body,
    });
    if (result.ok) {
      WeeklyPlan.log("outreach", { kind: "gmail_send", to: email, jobId: contact.jobId });
      if (typeof ApplyMemory !== "undefined") {
        ApplyMemory.add(state, {
          jobId: contact.jobId,
          company: job.company || "",
          role: job.title || "",
          outcome: "sent",
          channel: "email",
          lesson: `Envoyé via Gmail à ${email}`,
        });
        persist();
      }
      toast(`Envoyé via ton Gmail → ${email}`);
    } else if (result.path === "fallback_mailto" || result.path === "cancelled_mailto") {
      toast(result.error || "Brouillon ouvert (Gmail non connecté ou annulé)");
    } else {
      toast(result.error || "Envoi impossible");
    }
  }

  function queueJob(jobId) {
    if (state.applyQueue.some((q) => q.jobId === jobId)) {
      toast("Déjà dans la file");
      return;
    }
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const answer = `Bonjour,\n\nCandidature pour ${job.title} chez ${job.company}.\n\n${state.profile.summary || ""}\n\nJe vise un meilleur poste (upgrade réel). Disponibilité: immédiate pour un échange.\n\n${state.profile.fullName || ""}`;
    const item = {
      id: AscendStore.uid("q"),
      jobId,
      answer,
      at: Date.now(),
    };
    const prime = FreshRadar.primeApplyScore(job, state.profile);
    if (prime.urgency === "apply_now" || prime.fresh.tier.id === "prime") {
      state.applyQueue.unshift(item);
    } else {
      state.applyQueue.push(item);
    }
    if (state.settings.freshFirst) {
      state.applyQueue.sort((a, b) => {
        const ja = state.jobs.find((j) => j.id === a.jobId);
        const jb = state.jobs.find((j) => j.id === b.jobId);
        if (!ja || !jb) return 0;
        return (
          FreshRadar.primeApplyScore(jb, state.profile).combined -
          FreshRadar.primeApplyScore(ja, state.profile).combined
        );
      });
    }
    persist();
    toast(prime.urgency === "apply_now" ? "En tête de file — APPLY NOW" : "Ajouté à Apply Queue");
    render();
  }

  function addJobFromForm() {
    const desc = $("#job-desc").value.trim();
    const preset = $("#job-fresh")?.value || "under_1h";
    let postedAt = FreshRadar.postedAtFromPreset(preset);
    const parsed = FreshRadar.parsePostedFromText(desc);
    if (parsed && (preset === "unknown" || preset === "under_24h")) postedAt = parsed;

    const job = {
      id: AscendStore.uid("job"),
      title: $("#job-title").value.trim(),
      company: $("#job-company").value.trim(),
      location: $("#job-location").value.trim(),
      employerType: $("#job-type").value,
      status: "saved",
      url: $("#job-url").value.trim(),
      description: desc,
      tags: $("#job-tags").value
        .split(/,/)
        .map((s) => s.trim())
        .filter(Boolean),
      postedAt: postedAt || Date.now(),
      createdAt: Date.now(),
    };
    if (!job.title || !job.company) {
      toast("Titre et entreprise requis");
      return;
    }
    state.jobs.unshift(job);
    persist();
    $("#job-title").value = "";
    $("#job-company").value = "";
    $("#job-desc").value = "";
    const prime = FreshRadar.primeApplyScore(job, state.profile);
    toast(
      prime.urgency === "apply_now"
        ? "Offre PRIME ajoutée — postule maintenant"
        : `Offre ajoutée · ${prime.fresh.tier.short} · ${prime.fresh.ageLabel}`
    );
    render();
  }

  function renderFresh() {
    if (!$("#fresh-list")) return;
    const hours = Number($("#fresh-window")?.value) || state.settings.freshWindowHours || 24;
    const minCareer = Number($("#fresh-min-career")?.value) || state.settings.minCareerForPrime || 50;
    if ($("#fresh-window")) $("#fresh-window").value = hours;
    if ($("#fresh-min-career")) $("#fresh-min-career").value = minCareer;
    if ($("#fresh-custom-rss") && !$("#fresh-custom-rss").dataset.ready) {
      $("#fresh-custom-rss").value = (state.settings.customRssFeeds || []).join("\n");
      $("#fresh-custom-rss").dataset.ready = "1";
    }

    const srcRoot = $("#fresh-sources");
    if (srcRoot && typeof JobSources !== "undefined") {
      const enabled = new Set(
        state.settings.jobSourceIds || JobSources.SOURCES.filter((s) => s.enabledDefault).map((s) => s.id)
      );
      srcRoot.innerHTML = JobSources.SOURCES.map(
        (s) => `<div class="vector-item">
          <input type="checkbox" id="src-${s.id}" data-source="${s.id}" ${enabled.has(s.id) ? "checked" : ""} />
          <label for="src-${s.id}">${escapeHtml(s.label)}
            <small>${escapeHtml(s.freshnessNote)}</small>
          </label>
        </div>`
      ).join("");
    }

    const ranked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
      maxAgeMs: hours * 3600 * 1000,
      minCareer: 0,
    });
    const prime = ranked.filter((j) => j.prime.fresh.tier.id === "prime");
    const day = ranked.filter((j) => j.prime.fresh.ageMs != null && j.prime.fresh.ageMs <= 24 * 3600 * 1000);
    const applyNow = ranked.filter(
      (j) => j.prime.urgency === "apply_now" || (j.prime.urgency === "high" && j.prime.career.score >= minCareer)
    );

    $("#fresh-stat-prime").textContent = String(prime.length);
    $("#fresh-stat-24").textContent = String(day.length);
    $("#fresh-stat-now").textContent = String(applyNow.length);

    $("#fresh-list").innerHTML = ranked.length
      ? ranked
          .map((j) => {
            const p = j.prime;
            const urgChip =
              p.urgency === "apply_now"
                ? "chip-ok"
                : p.urgency === "high"
                  ? "chip-lime"
                  : p.urgency === "soon"
                    ? "chip-info"
                    : "chip-warn";
            return `<article class="panel" style="margin-bottom:0.75rem">
              <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:start">
                <div>
                  <h3 style="margin:0 0 0.35rem">${escapeHtml(j.title)}</h3>
                  <div class="meta" style="color:var(--mist)">${escapeHtml(j.company)} · ${escapeHtml(
              j.location || ""
            )} · <em>${escapeHtml(j.source || "")}</em></div>
                </div>
                <div>
                  <span class="chip ${chipClass(p.fresh.tier.tone)}">${escapeHtml(p.fresh.tier.short)} · ${escapeHtml(
              p.fresh.ageLabel
            )}</span>
                  <span class="chip ${urgChip}" style="margin-left:0.35rem">${escapeHtml(p.urgency)}</span>
                </div>
              </div>
              <div class="score-bar"><span style="width:${p.combined}%"></span></div>
              <div class="meta" style="color:var(--mist);font-size:0.85rem">
                Score prime ${p.combined} · carrière ${p.career.score} · fraîcheur ${p.fresh.score}
              </div>
              <p style="color:var(--mist);font-size:0.9rem;margin:0.5rem 0">${escapeHtml(p.reason)}</p>
              <div class="row-actions">
                <button class="btn btn-primary" data-act="queue" data-id="${j.id}" type="button">Mettre en tête de file</button>
                ${
                  j.url
                    ? `<a class="btn btn-soft" href="${escapeHtml(j.url)}" target="_blank" rel="noopener">Ouvrir offre</a>`
                    : ""
                }
              </div>
            </article>`;
          })
          .join("")
      : `<p style="color:var(--mist)">Aucune offre dans la fenêtre. Agrège les sources ou ajoute manuellement en PRIME.</p>`;
  }

  async function fetchFreshJobs() {
    const status = $("#fresh-fetch-status");
    const reportEl = $("#fresh-source-report");
    const q = $("#fresh-query")?.value.trim() || "";
    const hours = Number($("#fresh-window")?.value) || 24;
    const enabledIds = $$("#fresh-sources input[data-source]:checked").map((el) => el.dataset.source);
    const customRss = ($("#fresh-custom-rss")?.value || "")
      .split(/\n/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));

    state.settings.jobSourceIds = enabledIds;
    state.settings.customRssFeeds = customRss;
    persist();

    if (status) status.textContent = "Agrégation locale / fallback (0 clé requise)…";
    try {
      const aggregate = core()?.jobs?.aggregate || core()?.aggregateJobs;
      if (!aggregate) throw new Error("AscendCore indisponible");
      const { jobs: incoming, report, path, degraded } = await aggregate({
        query: q,
        hours,
        enabledIds,
        customRss,
        connectors: state.connectors,
        force: false,
        onProgress: (p) => {
          if (status) status.textContent = `${p.label || p.id}: ${p.status}${p.count != null ? ` (${p.count})` : ""}`;
        },
      });

      let added = 0;
      for (const job of incoming) {
        if (state.jobs.some((j) => j.externalId && j.externalId === job.externalId)) continue;
        if (job.url && state.jobs.some((j) => j.url && j.url === job.url)) continue;
        state.jobs.unshift({ ...job, id: AscendStore.uid("job") });
        added++;
      }
      persist();
      render();

      if (reportEl) {
        reportEl.innerHTML = report
          .map((r) => {
            const tone =
              r.status === "ok" || r.status === "cached" || r.status === "fallback_cache"
                ? "chip-ok"
                : r.status === "throttled" ||
                    r.status === "skipped" ||
                    r.status === "skipped_no_key" ||
                    r.status === "fallback" ||
                    r.status === "empty" ||
                    r.status === "down" ||
                    r.status === "degraded"
                  ? "chip-warn"
                  : "chip-bad";
            return `<span class="chip ${tone}" style="margin:0.2rem" title="${escapeHtml(r.note || "")}">${escapeHtml(
              r.id
            )}: ${escapeHtml(r.status)}${r.count != null ? ` ${r.count}` : ""}</span>`;
          })
          .join(" ");
      }
      if (status) {
        status.textContent = degraded
          ? `${incoming.length} offres · ${added} nouvelles · mode dégradé (${path}) — app locale OK`
          : `${incoming.length} offres · ${added} nouvelles · ${path}`;
      }
      toast(
        degraded
          ? `${added} offres (dégradé/${path}) — CV/file/profil restent OK`
          : `${added} nouvelles offres (${path})`
      );
    } catch (err) {
      // Never brick the app: keep existing jobs, local tools work
      if (status) {
        status.textContent = `Sources indisponibles (${err.message || "réseau"}). Offres déjà en local + CV/Apply OK.`;
      }
      if (reportEl) {
        reportEl.innerHTML = `<span class="chip chip-warn">offline · continue sans ce service</span>`;
      }
      toast("Réseau/API down — tu continues en local");
    }
  }

  function saveFreshSettings() {
    state.settings.freshWindowHours = Number($("#fresh-window")?.value) || 24;
    state.settings.minCareerForPrime = Number($("#fresh-min-career")?.value) || 50;
    state.settings.freshFirst = true;
    state.settings.jobSourceIds = $$("#fresh-sources input[data-source]:checked").map((el) => el.dataset.source);
    state.settings.customRssFeeds = ($("#fresh-custom-rss")?.value || "")
      .split(/\n/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    persist();
    toast("Réglages sources / fraîcheur sauvés");
    renderFresh();
  }

  function sortApplyQueueFreshFirst() {
    state.applyQueue.sort((a, b) => {
      const ja = state.jobs.find((j) => j.id === a.jobId);
      const jb = state.jobs.find((j) => j.id === b.jobId);
      if (!ja || !jb) return 0;
      const pa = FreshRadar.primeApplyScore(ja, state.profile);
      const pb = FreshRadar.primeApplyScore(jb, state.profile);
      return pb.combined - pa.combined;
    });
    persist();
    renderApplyQueue();
    toast("File triée : frais + levier d'abord");
  }

  function queueAllPrime() {
    const minCareer = Number($("#fresh-min-career")?.value) || state.settings.minCareerForPrime || 50;
    const ranked = FreshRadar.rankForFirstApply(state.jobs, state.profile, {
      maxAgeMs: (Number($("#fresh-window")?.value) || 24) * 3600 * 1000,
      minCareer,
    }).filter((j) => j.prime.urgency === "apply_now" || j.prime.urgency === "high");
    let n = 0;
    for (const j of ranked) {
      if (!state.applyQueue.some((q) => q.jobId === j.id)) {
        queueJob(j.id);
        n++;
      }
    }
    sortApplyQueueFreshFirst();
    toast(n ? `${n} offres en file (prime)` : "Rien de nouveau à filer");
  }

  function saveConnectorFields() {
    if (!AscendSecurity.isUnlocked() && AscendSecurity.getMode() === "passphrase") {
      toast("Déverrouille le coffre d'abord");
      return false;
    }
    Connectors.saveConfig(state, {
      gmailClientId: $("#gmail-client-id")?.value,
      linkedinClientId: $("#linkedin-client-id")?.value,
    });
    state.connectors.adzunaAppId = $("#adzuna-app-id")?.value.trim() || "";
    state.connectors.adzunaAppKey = $("#adzuna-app-key")?.value.trim() || "";
    state.connectors.aggregateApiBase = $("#aggregate-api-base")?.value.trim().replace(/\/$/, "") || "";
    state.connectors.hunterApiKey = $("#hunter-api-key")?.value.trim() || "";
    state.connectors.underIaApiKey = $("#under-ia-key")?.value.trim() || "";
    state.connectors.underIaApiBase = ($("#under-ia-base")?.value.trim() || "").replace(/\/$/, "");
    persist();
    return true;
  }

  async function applyMagicLink(raw) {
    const payload = Connectors.parseMagicToken(raw);
    if (!payload) {
      toast("Magic link invalide");
      return false;
    }
    try {
      let secrets = payload;
      if (payload.enc || payload.v === 2) {
        const pass = $("#magic-link-pass")?.value || $("#vault-pass")?.value || "";
        secrets = await AscendSecurity.openMagicPayload(payload, pass);
      } else if (AscendSecurity.getMode() === "passphrase") {
        toast("Lien en clair détecté — migre vers un magic link chiffré après import");
      }
      Connectors.applyMagicPayload(state, secrets);
      persist();
      try {
        sessionStorage.removeItem("ascendos.pendingMagic");
      } catch {
        /* ignore */
      }
      renderConnectors();
      toast("Magic link appliqué — secrets dans le coffre");
      return true;
    } catch (e) {
      toast(e.message || "Échec magic link");
      return false;
    }
  }

  async function runOneClickAction(item) {
    if (item.action === "copy_gemini_prompt") {
      try {
        await navigator.clipboard.writeText(Connectors.GEMINI_PROMPT);
        toast("Prompt IA copié — colle-le dans ton assistant");
      } catch {
        toast("Impossible de copier le prompt");
      }
    }
    if (item.action === "oauth_gmail") {
      if (!saveConnectorFields()) return;
      const id = state.connectors.gmailClientId;
      if (!id) {
        core()?.session?.bindLocal?.(state.profile, "local");
        const draft = Connectors.buildRecruiterOutreach(state.profile, state.jobs[0]);
        core()?.openMailDraft?.(draft) || Connectors.mailtoDraft(draft);
        toast("Sans Client ID → mailto / Gmail web (local). OAuth reste optionnel.");
        return;
      }
      const redirect = window.location.href.split("#")[0].split("?")[0];
      const nonce = AscendSecurity.createOAuthState("gmail");
      window.location.href = Connectors.buildGmailAuthUrl(id, redirect, nonce);
      return;
    }
    if (item.action === "oauth_linkedin") {
      if (!saveConnectorFields()) return;
      const id = state.connectors.linkedinClientId;
      if (!id) {
        bindLinkedInSessionLocal();
        toast("Sans Client ID → liaison LinkedIn locale (profil)");
        return;
      }
      const redirect = window.location.href.split("#")[0].split("?")[0];
      const nonce = AscendSecurity.createOAuthState("linkedin");
      window.location.href = Connectors.buildLinkedInAuthUrl(id, redirect, nonce);
      return;
    }
    if (item.href) Connectors.openExternal(item.href);
  }

  async function renderConnectors() {
    const locked = AscendSecurity.getMode() === "passphrase" && !AscendSecurity.isUnlocked();
    const st = AscendSecurity.status();
    if ($("#vault-status")) {
      $("#vault-status").textContent = locked
        ? "Coffre · verrouillé"
        : `Coffre · ${st.mode} · ${st.secretCount} secret(s) · auto-lock ${st.autoLockMinutes} min`;
      $("#vault-status").className = `chip ${locked ? "chip-warn" : "chip-ok"}`;
    }

    const fill = (id, val) => {
      const el = $(id);
      if (!el) return;
      el.value = locked ? "" : val || "";
      el.disabled = locked;
      el.placeholder = locked ? "•••• verrouillé" : el.getAttribute("data-ph") || el.placeholder;
    };
    fill("#gmail-client-id", state.connectors.gmailClientId);
    fill("#linkedin-client-id", state.connectors.linkedinClientId);
    fill("#adzuna-app-id", state.connectors.adzunaAppId);
    fill("#adzuna-app-key", state.connectors.adzunaAppKey);
    fill("#aggregate-api-base", state.connectors.aggregateApiBase);
    fill("#hunter-api-key", state.connectors.hunterApiKey);
    fill("#under-ia-key", state.connectors.underIaApiKey);
    if ($("#under-ia-base")) {
      $("#under-ia-base").value = state.connectors.underIaApiBase || "";
      $("#under-ia-base").disabled = false;
    }

    const token = await Connectors.getStoredToken();
    const gmailOk = state.connectors.gmailConnected || token;
    if ($("#gmail-status")) {
      $("#gmail-status").textContent = gmailOk
        ? "Gmail · prêt à envoyer (ton compte)"
        : state.connectors.gmailClientId
          ? "Gmail · Client ID OK — connecte pour envoyer"
          : "Gmail · mailto si pas connecté";
      $("#gmail-status").className = `chip ${gmailOk || state.connectors.gmailClientId ? "chip-ok" : "chip-info"}`;
    }
    if ($("#linkedin-status")) {
      const liOk = state.connectors.linkedinConnected || state.connectors.linkedinClientId;
      $("#linkedin-status").textContent = state.connectors.linkedinConnected
        ? "LinkedIn · connecté"
        : state.connectors.linkedinClientId
          ? "LinkedIn · prêt (1-clic)"
          : "LinkedIn · coller profil";
      $("#linkedin-status").className = `chip ${liOk ? "chip-ok" : "chip-info"}`;
    }
    const geminiTxt = state.connectors.lastGeminiImportAt
      ? new Date(state.connectors.lastGeminiImportAt).toLocaleString()
      : "Jamais";
    if ($("#gemini-last")) $("#gemini-last").textContent = geminiTxt;
    if ($("#gemini-last-chip")) $("#gemini-last-chip").textContent = `IA · ${geminiTxt}`;

    const capRoot = $("#local-stack-caps");
    const facade = core();
    if (capRoot && facade) {
      const h = facade.health?.(state) || { cooling: [], mode: "ok" };
      const sum = facade.stackSummary?.(state);
      let healthNote = "";
      if (h.cooling?.length) {
        healthNote = `<p style="color:var(--mist);font-size:0.8rem;margin:0.5rem 0 0">Cooldown (hôtes down): ${h.cooling
          .map((x) => escapeHtml(x.host))
          .join(", ")} — l’app continue en local/cache.</p>`;
      } else if (sum) {
        healthNote = `<p style="color:var(--mist);font-size:0.8rem;margin:0.5rem 0 0">${escapeHtml(
          sum.text
        )} — labels unifiés local / upgrade / cooldown.</p>`;
      }
      capRoot.innerHTML =
        `<p style="color:var(--mist);font-size:0.82rem;margin:0 0 0.5rem">Une logique pour tous les modules (AscendCore) : upgrade → soft-fail → local. Jamais bloquer CV / file / profil / AutoFill.</p>` +
        (facade.statusChipsHtml?.(state, escapeHtml) || "") +
        healthNote;
    }
    renderStackChip();

    const grid = $("#oneclick-grid");
    if (grid) {
      const top = state.applyQueue[0] && state.jobs.find((j) => j.id === state.applyQueue[0].jobId);
      const draft = Connectors.buildRecruiterOutreach(state.profile, top || state.jobs[0]);
      const links = Connectors.oneClickLinks(state.profile, draft);
      grid.innerHTML = links
        .map(
          (item) => `<button type="button" class="oneclick-card btn-${item.tone || "soft"}" data-oc="${escapeHtml(
            item.id
          )}">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.blurb)}</span>
        </button>`
        )
        .join("");
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    renderSession();
    renderQuotas();
    renderCockpit();
    renderJobIntel();
    renderDashboard();
    renderProfile();
    renderAccelerator();
    renderPasserelles();
    renderCvStudio();
    renderLinkedIn();
    renderPipeline();
    renderApplyQueue();
    renderFresh();
    renderAutofill();
    renderEmailFinder();
    renderConnectors();
  }

  function bind() {
    $("#btn-oneclick")?.addEventListener("click", runOneClickWorkflow);
    $("#wf-pick")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-wf]");
      if (!card) return;
      selectedWorkflowId = card.dataset.wf;
      renderCockpit();
    });
    $("#wf-next-actions")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]");
      if (!b) return;
      navigate(b.dataset.go);
    });

    $$(".side-link").forEach((a) =>
      a.addEventListener("click", (e) => {
        if (!a.dataset.view) return; // external / real href (ex: paths.html)
        e.preventDefault();
        navigate(a.dataset.view);
        $("#sidebar").classList.remove("open");
      })
    );

    $("#mobile-nav-toggle")?.addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
    });

    $("#btn-save-profile")?.addEventListener("click", saveProfileFromForm);
    $("#btn-suggest-vectors")?.addEventListener("click", suggestVectors);
    $("#btn-ask-work-prefs")?.addEventListener("click", () => askWorkPrefsInteractive());
    $("#btn-ack-disclaimer")?.addEventListener("click", () => {
      try {
        localStorage.setItem("ascendos.disclaimer.ack", "1");
      } catch {
        /* */
      }
      $("#disclaimer-banner")?.setAttribute("hidden", "");
    });
    $("#btn-run-ats")?.addEventListener("click", runAts);
    $("#btn-boost-cv")?.addEventListener("click", boostCv);
    $("#btn-tailor-cv")?.addEventListener("click", tailorCvFromUi);
    $("#btn-cv-nl")?.addEventListener("click", reviseCvNl);
    $("#btn-cv-scan")?.addEventListener("click", scanCvIssues);
    $("#btn-cv-pdf")?.addEventListener("click", printCvPdf);
    $("#btn-gen-letter")?.addEventListener("click", generateLetterFromUi);
    $("#btn-letter-nl")?.addEventListener("click", reviseLetterNl);
    $("#btn-copy-letter")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText($("#letter-preview")?.value || "");
      toast("Lettre copiée");
    });
    $("#btn-mem-add")?.addEventListener("click", addApplyMemoryFromUi);
    $("#btn-auth-enable")?.addEventListener("click", async () => {
      try {
        await AscendAuth.enablePassword($("#auth-pass")?.value || "");
        refreshAuthStatus();
        toast("Login local activé · JWT minté");
      } catch (e) {
        toast(e.message || "Échec activation");
      }
    });
    $("#btn-auth-lock")?.addEventListener("click", async () => {
      persist();
      await AscendAuth.lock({ reseal: true });
      refreshAuthStatus();
      await showAuthGateIfNeeded();
      toast("Session verrouillée");
    });
    $("#btn-auth-disable")?.addEventListener("click", () => {
      AscendAuth.disableAuth();
      refreshAuthStatus();
      $("#auth-gate")?.setAttribute("hidden", "");
      toast("Login désactivé");
    });
    $("#btn-gate-login")?.addEventListener("click", () => gateLoginPassword());
    $("#gate-pass")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") gateLoginPassword();
    });
    $("#btn-gate-google")?.addEventListener("click", () => {
      startGoogleSession();
    });
    $("#btn-gate-linkedin")?.addEventListener("click", async () => {
      bindLinkedInSessionLocal();
      if (typeof AscendAuth !== "undefined") {
        const sess = AscendSession.load();
        await AscendAuth.loginOAuth({
          provider: "linkedin",
          name: sess.name,
          email: sess.email,
          sub: sess.sub || sess.linkedinUrl,
        });
        $("#auth-gate")?.setAttribute("hidden", "");
        refreshAuthStatus();
      }
    });
    $("#btn-add-job")?.addEventListener("click", addJobFromForm);
    $("#btn-sort-queue-fresh")?.addEventListener("click", sortApplyQueueFreshFirst);
    $("#btn-fetch-fresh")?.addEventListener("click", fetchFreshJobs);
    $("#btn-queue-all-prime")?.addEventListener("click", queueAllPrime);
    $("#btn-batch-apply")?.addEventListener("click", () => runBatchOrLoop({ loop: false }));
    $("#btn-loop-apply")?.addEventListener("click", () => runBatchOrLoop({ loop: true }));
    $("#btn-save-fresh-settings")?.addEventListener("click", saveFreshSettings);
    $("#btn-af-build")?.addEventListener("click", () => buildAutofillPack());
    $("#btn-af-detect")?.addEventListener("click", () => {
      const p = AutoFill.detectPortal($("#af-url")?.value || "");
      if ($("#af-portal")) $("#af-portal").value = p.id;
      toast(`Portail: ${p.label}`);
    });
    $("#btn-af-ask-gaps")?.addEventListener("click", () => askProfileGapsInteractive());
    $("#btn-enrich-wikidata")?.addEventListener("click", async () => {
      const hitsRoot = $("#enrich-hits");
      if (hitsRoot) hitsRoot.textContent = "Recherche publique…";
      try {
        const out = await (core()?.enrich?.public?.(state.profile.fullName) ||
          PublicEnrich.fetchWikidataHints(state.profile.fullName));
        if (!out.ok || !out.hits?.length) {
          if (hitsRoot)
            hitsRoot.innerHTML = `<p style="color:var(--mist)">Aucun hint public (${escapeHtml(
              out.path || "—"
            )}) — essaie un collage manuel.</p>`;
          return;
        }
        if (hitsRoot) {
          hitsRoot.innerHTML = out.hits
            .map(
              (h) => `<div class="job-card"><h4>${escapeHtml(h.label)}</h4>
              <div class="meta">${escapeHtml(h.description)}</div>
              <a class="btn btn-ghost btn-tiny" href="${escapeHtml(h.url)}" target="_blank" rel="noopener">Ouvrir</a></div>`
            )
            .join("");
        }
        toast(`${out.hits.length} hint(s) publics (${out.path || "wikidata"})`);
      } catch (e) {
        toast(e.message || "Enrichissement indisponible");
      }
    });
    $("#btn-enrich-edu-paste")?.addEventListener("click", () => {
      const raw = $("#enrich-paste")?.value || "";
      const edu = PublicEnrich.educationFromPaste(raw);
      if (!edu.length) {
        toast("Aucun diplôme détecté dans le collage");
        return;
      }
      state.profile.education = [...new Set([...(state.profile.education || []), ...edu])];
      persist();
      renderProfile();
      if ($("#enrich-hits")) {
        $("#enrich-hits").innerHTML = edu.map((e) => `<span class="chip chip-ok">${escapeHtml(e)}</span>`).join(" ");
      }
      toast(`${edu.length} formation(s) ajoutée(s)`);
    });
    $("#btn-af-copy-json")?.addEventListener("click", async () => {
      if (!lastFillPack) buildAutofillPack();
      await navigator.clipboard.writeText(AutoFill.exportJson(lastFillPack));
      toast("JSON AutoFill copié");
    });
    $("#btn-af-download-json")?.addEventListener("click", () => {
      if (!lastFillPack) buildAutofillPack();
      const blob = new Blob([AutoFill.exportJson(lastFillPack)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ascendos-autofill.json";
      a.click();
    });
    $("#btn-af-copy-csv")?.addEventListener("click", async () => {
      if (!lastFillPack) buildAutofillPack();
      await navigator.clipboard.writeText(AutoFill.exportCsv(lastFillPack));
      toast("CSV AutoFill copié");
    });

    $("#fresh-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act=queue]");
      if (!btn) return;
      queueJob(btn.dataset.id);
    });

    $("#btn-fill-ats-resume")?.addEventListener("click", () => {
      $("#ats-resume").value = profileResumeText();
    });

    $("#btn-import-linkedin")?.addEventListener("click", () => {
      const raw = $("#import-linkedin").value;
      const { patch } = ProfileImporter.fromLinkedInPaste(raw);
      state.profile = ProfileImporter.applyPatch(state.profile, patch);
      const smart = Passerelles.suggestVectorsFromProfile(state.profile);
      if (smart.vectorIds?.length) state.profile.activeVectors = smart.vectorIds;
      persist();
      render();
      toast("LinkedIn importé (local, pas d’API requise) — passerelles & vecteurs recalculés");
    });

    $("#btn-orient-cv")?.addEventListener("click", orientCvFromPasserelle);
    $("#btn-save-oriented-cv")?.addEventListener("click", saveOrientedCv);
    $("#btn-apply-passerelle-vectors")?.addEventListener("click", applyPasserelleVectors);
    $("#btn-copy-oriented-cv")?.addEventListener("click", async () => {
      const text = `${$("#pass-cv-headline")?.value || ""}\n\n${$("#pass-cv-body")?.value || ""}`;
      await navigator.clipboard.writeText(text);
      toast("CV orienté copié");
    });

    $("#btn-import-ai")?.addEventListener("click", () => {
      const raw = $("#import-ai").value;
      const { patch, source } = ProfileImporter.fromAiPayload(raw);
      state.profile = ProfileImporter.applyPatch(state.profile, patch);
      state.profile.aiImports = state.profile.aiImports || [];
      state.profile.aiImports.unshift({ at: Date.now(), source, preview: raw.slice(0, 200) });
      state.connectors.lastGeminiImportAt = Date.now();
      persist();
      renderProfile();
      renderConnectors();
      toast("Import IA fusionné (local, pas d’API AscendOS requise)");
    });

    $("#btn-session-google")?.addEventListener("click", startGoogleSession);
    $("#btn-session-linkedin")?.addEventListener("click", bindLinkedInSessionLocal);
    $("#btn-session-signout")?.addEventListener("click", signOutSession);
    $("#btn-session-out")?.addEventListener("click", signOutSession);

    $("#btn-save-connectors")?.addEventListener("click", () => {
      if (saveConnectorFields()) toast("Secrets sauvés dans le coffre chiffré");
    });

    const setAggregateBase = (url, label) => {
      const el = $("#aggregate-api-base");
      if (!el) return;
      if (AscendSecurity.getMode() === "passphrase" && !AscendSecurity.isUnlocked()) {
        toast("Déverrouille le coffre d’abord");
        return;
      }
      el.value = url || "";
      state.connectors.aggregateApiBase = (url || "").replace(/\/$/, "");
      persist();
      renderConnectors();
      renderStackChip();
      toast(label);
    };
    $("#btn-use-agg-vercel")?.addEventListener("click", () => {
      const hints = core()?.liveAggregateHints?.() || { vercel: "https://ascendos-nine.vercel.app" };
      setAggregateBase(hints.vercel, "Agrégateur Vercel live activé");
    });
    $("#btn-use-agg-cf")?.addEventListener("click", () => {
      const hints = core()?.liveAggregateHints?.() || {};
      setAggregateBase(
        hints.cloudflare || "https://ascendos-aggregate.dlnraja-ascendos.workers.dev",
        "URL Cloudflare collée — deploy Worker après vérif email CF"
      );
    });
    $("#btn-clear-agg")?.addEventListener("click", () => {
      setAggregateBase("", "Radar en local only (0 backend)");
    });

    $("#btn-magic-apply")?.addEventListener("click", () => {
      applyMagicLink($("#magic-link-input")?.value || "");
    });
    $("#magic-link-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyMagicLink($("#magic-link-input").value);
      }
    });
    $("#btn-magic-copy")?.addEventListener("click", async () => {
      if (!saveConnectorFields()) return;
      try {
        if (!(AscendSecurity.getMode() === "passphrase" && AscendSecurity.isUnlocked())) {
          toast("Active d'abord une passphrase (panneau Coffre) pour un lien chiffré");
          navigate("connectors");
          return;
        }
        const url = await Connectors.secureMagicLinkUrl(state.connectors);
        await navigator.clipboard.writeText(url);
        if ($("#magic-link-input")) $("#magic-link-input").value = url;
        toast("Magic link chiffré copié");
        renderConnectors();
      } catch (e) {
        toast(e.message || "Impossible de créer le magic link");
      }
    });

    const lockBtns = ["#btn-vault-lock", "#btn-vault-lock-inline"];
    lockBtns.forEach((sel) => $(sel)?.addEventListener("click", lockVaultUi));

    $("#btn-vault-enable")?.addEventListener("click", async () => {
      const p1 = $("#vault-pass")?.value || "";
      const p2 = $("#vault-pass2")?.value || "";
      if (p1 !== p2) {
        toast("Passphrases différentes");
        return;
      }
      try {
        // Capture current form secrets into memory before re-sealing with passphrase
        Connectors.saveConfig(state, {
          gmailClientId: $("#gmail-client-id")?.value,
          linkedinClientId: $("#linkedin-client-id")?.value,
        });
        state.connectors.adzunaAppId = $("#adzuna-app-id")?.value.trim() || state.connectors.adzunaAppId || "";
        state.connectors.adzunaAppKey = $("#adzuna-app-key")?.value.trim() || state.connectors.adzunaAppKey || "";
        state.connectors.aggregateApiBase =
          $("#aggregate-api-base")?.value.trim().replace(/\/$/, "") || state.connectors.aggregateApiBase || "";
        state.connectors.hunterApiKey = $("#hunter-api-key")?.value.trim() || state.connectors.hunterApiKey || "";
        state.connectors.underIaApiKey = $("#under-ia-key")?.value.trim() || state.connectors.underIaApiKey || "";
        state.connectors.underIaApiBase =
          ($("#under-ia-base")?.value.trim() || state.connectors.underIaApiBase || "").replace(/\/$/, "");
        await AscendSecurity.persistSecretsFrom(state.connectors);
        await AscendSecurity.enablePassphrase(p1);
        AscendStore.save(state);
        renderConnectors();
        toast("Passphrase activée — coffre renforcé");
        if ($("#vault-pass")) $("#vault-pass").value = "";
        if ($("#vault-pass2")) $("#vault-pass2").value = "";
      } catch (e) {
        toast(e.message || "Échec activation");
      }
    });

    $("#btn-vault-unlock")?.addEventListener("click", async () => {
      const pass = $("#vault-pass2")?.value || $("#vault-pass")?.value || "";
      try {
        await AscendSecurity.unlockPassphrase(pass);
        AscendSecurity.applySecretsToState(state);
        render();
        toast("Coffre déverrouillé");
      } catch (e) {
        toast(e.message || "Passphrase incorrecte");
      }
    });

    $("#btn-vault-wipe")?.addEventListener("click", async () => {
      if (!confirm("Effacer définitivement toutes les API keys / tokens du coffre ?")) return;
      await AscendSecurity.wipeSecrets();
      AscendSecurity.clearSecretsFromState(state);
      state.connectors.gmailConnected = false;
      AscendStore.save(state);
      render();
      toast("Secrets effacés");
    });

    $("#btn-clear-oauth")?.addEventListener("click", () => {
      AscendSecurity.clearOAuthToken();
      state.connectors.gmailConnected = false;
      persist();
      renderConnectors();
      toast("Token OAuth révoqué (session)");
    });

    window.addEventListener("ascendos:vault-lock", () => {
      AscendSecurity.clearSecretsFromState(state);
      state.connectors.gmailConnected = false;
      render();
      toast("Auto-lock : coffre verrouillé");
    });

    $("#oneclick-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-oc]");
      if (!btn) return;
      const top = state.applyQueue[0] && state.jobs.find((j) => j.id === state.applyQueue[0].jobId);
      const draft = Connectors.buildRecruiterOutreach(state.profile, top || state.jobs[0]);
      const item = Connectors.oneClickLinks(state.profile, draft).find((x) => x.id === btn.dataset.oc);
      if (item) runOneClickAction(item);
    });

    $("#btn-connect-gmail")?.addEventListener("click", () => {
      runOneClickAction({ action: "oauth_gmail" });
    });

    $("#btn-connect-linkedin")?.addEventListener("click", () => {
      runOneClickAction({ action: "oauth_linkedin" });
    });

    $("#btn-export-json")?.addEventListener("click", () => {
      const safe = AscendSecurity.redactState(state);
      const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ascendos-profile.json";
      a.click();
      toast("Export sans API keys / tokens");
    });

    $("#btn-import-json")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const secrets = AscendSecurity.extractSecrets(parsed.connectors || {});
        state = AscendStore.defaultState();
        state = { ...state, ...parsed };
        state.connectors = AscendSecurity.stripSecrets(state.connectors || {});
        if (AscendSecurity.hasAnySecret(secrets)) {
          Object.assign(state.connectors, secrets);
          if (!AscendSecurity.isUnlocked()) {
            await AscendSecurity.unlockDevice();
          }
        }
        persist();
        render();
        toast(
          AscendSecurity.hasAnySecret(secrets)
            ? "Import OK — secrets migrés dans le coffre"
            : "Backup JSON importé"
        );
      } catch {
        toast("JSON invalide");
      }
    });

    $("#accel-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "open") openJob(btn.dataset.id);
      if (btn.dataset.act === "queue") queueJob(btn.dataset.id);
      if (btn.dataset.act === "status") {
        const job = state.jobs.find((j) => j.id === btn.dataset.id);
        if (job) {
          job.status = btn.dataset.status;
          if (btn.dataset.status === "applied") WeeklyPlan.log("apply", { jobId: job.id });
          persist();
          render();
        }
      }
    });

    $("#apply-list")?.addEventListener("click", (e) => {
      const openBtn = e.target.closest("button[data-act=open-job]");
      if (openBtn) {
        openJob(openBtn.dataset.id);
        return;
      }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const qid = btn.dataset.qid;
      const item = state.applyQueue.find((q) => q.id === qid);
      if (!item) return;
      const job = state.jobs.find((j) => j.id === item.jobId);
      if (btn.dataset.act === "mailto") {
        const ta = $(`textarea[data-qid="${qid}"]`);
        if (ta) item.answer = ta.value;
        const draft = Connectors.buildRecruiterOutreach(state.profile, job);
        const body = `${draft.body}\n\n---\nRéponses formulaire ATS/CRM:\n${item.answer}`;
        persist();
        sendViaCore({
          to: draft.to || "",
          subject: draft.subject,
          body,
        }).then((r) => {
          if (r.ok) {
            WeeklyPlan.log("outreach", { jobId: item.jobId });
            toast("Envoyé via ton Gmail");
          } else toast(r.error || "Brouillon ouvert (connecte Gmail pour envoyer)");
        });
      }
      if (btn.dataset.act === "mail-contact") {
        const contact = (state.contacts || []).find((c) => c.id === btn.dataset.cid);
        if (contact) dualMailContact(contact);
      }
      if (btn.dataset.act === "autofill") {
        if ($("#af-job")) $("#af-job").value = item.jobId;
        buildAutofillPack(item.jobId);
        navigate("autofill");
      }
      if (btn.dataset.act === "done") {
        if (job) {
          const r = jobContext(job).readiness;
          if (!r.canSend && !confirm(`Ready ${r.total}% — ${r.verdict}. Marquer quand même comme envoyé ?`)) return;
          job.status = "applied";
          WeeklyPlan.log("apply", { jobId: job.id });
        }
        state.applyQueue = state.applyQueue.filter((q) => q.id !== qid);
        persist();
        render();
        toast("Marqué applied");
      }
      if (btn.dataset.act === "drop") {
        state.applyQueue = state.applyQueue.filter((q) => q.id !== qid);
        persist();
        render();
      }
    });

    $("#apply-list")?.addEventListener("change", (e) => {
      const ta = e.target.closest("textarea.apply-answer");
      if (!ta) return;
      const item = state.applyQueue.find((q) => q.id === ta.dataset.qid);
      if (item) {
        item.answer = ta.value;
        persist();
      }
    });

    $("#btn-copy-li")?.addEventListener("click", async () => {
      const text = `HEADLINE\n${$("#li-headline").value}\n\nABOUT\n${$("#li-about").value}`;
      await navigator.clipboard.writeText(text);
      toast("Copié — colle sur LinkedIn");
    });

    $("#btn-learn-patterns")?.addEventListener("click", learnEmailPatterns);
    $("#btn-parse-card")?.addEventListener("click", parseCardToForm);
    $("#btn-guess-emails")?.addEventListener("click", runEmailGuess);
    $("#btn-guess-domain")?.addEventListener("click", guessDomainForJob);
    $("#btn-check-mx")?.addEventListener("click", checkMx);
    $("#btn-hunter-find")?.addEventListener("click", optionalApiEnrich);
    $("#btn-ef-export-csv")?.addEventListener("click", () => exportEmailCandidates("csv"));
    $("#btn-ef-export-json")?.addEventListener("click", () => exportEmailCandidates("json"));
    $("#btn-ef-export-patterns")?.addEventListener("click", () => exportEmailCandidates("patterns"));
    $("#btn-ef-copy-all")?.addEventListener("click", () => exportEmailCandidates("copy"));

    $("#ef-job")?.addEventListener("change", () => {
      const job = state.jobs.find((j) => j.id === $("#ef-job").value);
      if (job?.domain) $("#ef-domain").value = job.domain;
    });

    $("#ef-candidates")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const email = btn.dataset.email;
      if (btn.dataset.act === "pick-email") saveContactWithEmail(email);
      if (btn.dataset.act === "mail-guess") {
        const fullName = $("#ef-fullname")?.value.trim() || "";
        const title = $("#ef-title")?.value.trim() || "";
        let role = $("#ef-role")?.value || "auto";
        if (role === "auto") role = EmailFinder.detectRole(title);
        const jobId = $("#ef-job")?.value || "";
        const job = state.jobs.find((j) => j.id === jobId);
        const facade = core();
        const draft = prepareOutreachViaCore({
          job: job || { title: title || "le poste", company: $("#ef-domain")?.value || "" },
          contact: { fullName, role },
          email,
        });
        sendViaCore({
          to: draft.to || email,
          subject: draft.subject,
          body: draft.body,
        }).then((r) => {
          if (r.ok) {
            WeeklyPlan.log("outreach", { to: email });
            toast(`Envoyé via ton Gmail → ${email}`);
          } else toast(r.error || "Brouillon ouvert");
        });
      }
    });

    $("#ef-contacts")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const contact = (state.contacts || []).find((c) => c.id === btn.dataset.cid);
      if (!contact) return;
      if (btn.dataset.act === "mail-saved") dualMailContact(contact);
      if (btn.dataset.act === "drop-contact") {
        state.contacts = state.contacts.filter((c) => c.id !== contact.id);
        persist();
        renderEmailFinder();
        renderApplyQueue();
        toast("Contact supprimé");
      }
    });
  }

  // boot
  (async function boot() {
    ensureSeed();
    let bootView = "cockpit";
    const sec = await AscendSecurity.init(state);
    if (sec.migrated) {
      AscendStore.save(state);
      toast("Clés migrées vers le coffre chiffré");
    }

    // OAuth token in hash first (clears hash)
    const token = await Connectors.captureImplicitTokenFromHash();
    if (token) {
      state.connectors.gmailConnected = true;
      try {
        const sess = await AscendSession.fromGoogleAccessToken(token);
        state.profile = AscendSession.mergeIntoProfile(state.profile, sess);
        if (typeof AscendAuth !== "undefined") {
          await AscendAuth.loginOAuth({
            provider: "google",
            sub: sess.sub,
            email: sess.email,
            name: sess.name,
          });
        }
        toast(`Session Google locale · ${sess.email || sess.name || "OK"}`);
      } catch {
        toast("Token reçu — session identité non lue (scopes / réseau)");
      }
      persist();
      bootView = "connectors";
    }

    const magic = Connectors.captureMagicFromLocation();
    if (magic) {
      bootView = "connectors";
      if (magic.enc || magic.v === 2) {
        toast("Magic link chiffré — entre la passphrase puis Appliquer");
      } else {
        Connectors.applyMagicPayload(state, magic);
        persist();
        toast("Magic link appliqué — secrets dans le coffre");
      }
    }

    bind();

    try {
      if (!localStorage.getItem("ascendos.disclaimer.ack")) {
        $("#disclaimer-banner")?.removeAttribute("hidden");
      }
    } catch {
      $("#disclaimer-banner")?.removeAttribute("hidden");
    }

    const gated = await showAuthGateIfNeeded();
    refreshAuthStatus();
    if (gated) {
      // Still allow connectors/hash capture UI behind gate? Gate covers all — OK
    }

    const pendingTok = sessionStorage.getItem("ascendos.pendingMagic");
    if (pendingTok && $("#magic-link-input")) {
      $("#magic-link-input").value = pendingTok;
    }

    const hashView = (location.hash || "").replace(/^#/, "").split(/[/?&]/)[0];
    const initial =
      hashView && !hashView.startsWith("ml.") && !hashView.includes("access_token")
        ? hashView
        : bootView;
    if (sec.locked) bootView = "connectors";
    if (!gated) {
      navigate(sec.locked ? "connectors" : initial || "cockpit");
      if (sec.locked) toast("Coffre verrouillé — entre ta passphrase");
    }
  })();
})();
