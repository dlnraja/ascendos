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
        "Poste interne client final. Lead une squad data produit, ownership roadmap, stack cloud, management de 5 ingénieurs. Package + intéressement.",
      tags: ["lead", "data", "interne", "cac 40"],
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
      createdAt: Date.now(),
    },
  ];

  function persist() {
    AscendStore.save(state);
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
      dashboard: ["Tableau de bord", "Priorise les offres qui accélèrent ta carrière."],
      profile: ["Profil Vault", "CV + LinkedIn + imports Gemini / IA."],
      accelerator: ["Accélérateur", "Multi-vecteurs d'upgrade — tous métiers."],
      passerelles: ["Passerelles & leviers", "Ponts de carrière + coups de chance + CV honnête."],
      ats: ["ATS Match", "Style Jobscan — mots-clés CV ↔ offre."],
      cv: ["CV Studio", "Versions orientées sans mentir, tous métiers."],
      linkedin: ["LinkedIn Boost", "Headline, about, positionnement client final."],
      pipeline: ["Pipeline", "Tracker type Teal — du saved à l'offre."],
      apply: ["Apply Queue", "File FastApply / LoopCV — revue humaine."],
      emails: ["Email Finder RH/CP", "Nomenclatures + LinkedIn → mails en plus du CRM ATS."],
      connectors: ["Connecteurs", "Gmail, LinkedIn, Gemini / Workspace."],
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

  function renderDashboard() {
    const ranked = CareerAccelerator.rankJobs(state.jobs, state.profile);
    const strong = ranked.filter((j) => j.accelerator.score >= (state.settings.minAcceleratorScore || 60));
    $("#stat-jobs").textContent = String(state.jobs.length);
    $("#stat-accel").textContent = String(strong.length);
    $("#stat-queue").textContent = String(state.applyQueue.length);
    $("#stat-ats").textContent = state._lastAtsScore != null ? `${state._lastAtsScore}%` : "—";

    const list = $("#dash-ranked");
    list.innerHTML = ranked
      .slice(0, 6)
      .map((j) => {
        const a = j.accelerator;
        return `<article class="job-card">
          <h4>${escapeHtml(j.title)}</h4>
          <div class="meta">${escapeHtml(j.company)} · ${escapeHtml(j.location || "")}</div>
          <div class="score-bar"><span style="width:${a.score}%"></span></div>
          <span class="chip ${chipClass(a.tone)}">${a.score} · ${escapeHtml(a.label)}</span>
        </article>`;
      })
      .join("");
  }

  function renderProfile() {
    const p = state.profile;
    $("#pf-name").value = p.fullName || "";
    $("#pf-headline").value = p.headline || "";
    $("#pf-email").value = p.email || "";
    $("#pf-location").value = p.location || "";
    $("#pf-summary").value = p.summary || "";
    $("#pf-skills").value = (p.skills || []).join(", ");
    $("#pf-goal").value = p.careerGoal || "";
    $("#pf-linkedin").value = p.linkedinUrl || "";
    $("#pf-current").value = p.currentTrack || "esn";
    $("#pf-target").value = p.targetTrack || "end_client";
    $("#pf-years").value = p.yearsExp ?? 3;
    renderVectorPicker();
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
    state.profile.location = $("#pf-location").value.trim();
    state.profile.summary = $("#pf-summary").value.trim();
    state.profile.skills = $("#pf-skills").value
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
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

  function renderCvStudio() {
    const versions = state.cvVersions || [];
    $("#cv-list").innerHTML =
      versions
        .map(
          (v) => `<article class="job-card">
        <h4>${escapeHtml(v.name)}</h4>
        <div class="meta">${new Date(v.at).toLocaleString()} · cible: ${escapeHtml(v.target || "")}</div>
        <p style="color:var(--mist);font-size:0.9rem;white-space:pre-wrap">${escapeHtml(v.body.slice(0, 280))}…</p>
      </article>`
        )
        .join("") || `<p style="color:var(--mist)">Aucune version encore. Génère un boost depuis un scan ATS ou le profil.</p>`;
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
        persist();
        renderPipeline();
        toast(`Déplacé → ${col.dataset.status}`);
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
          <span class="chip ${chipClass(a.tone)}">Priorité carrière ${a.score}</span>
          <div class="field" style="margin-top:0.75rem">
            <label>Réponse formulaires ATS / CRM (éditable)</label>
            <textarea data-qid="${item.id}" class="apply-answer">${escapeHtml(item.answer || "")}</textarea>
          </div>
          ${contactBlock}
          <div class="row-actions">
            <button class="btn btn-primary" data-act="mailto" data-qid="${item.id}">Outreach générique</button>
            <button class="btn btn-ghost" data-act="done" data-qid="${item.id}">Marquer envoyé</button>
            <button class="btn btn-danger" data-act="drop" data-qid="${item.id}">Retirer</button>
          </div>
        </article>`;
      })
      .join("");
  }

  let lastEmailCandidates = [];

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
        : `<p style="color:var(--mist);font-size:0.9rem">Aucune nomenclature apprise. Colle des emails publics d'employés du groupe.</p>`;
    }

    const candRoot = $("#ef-candidates");
    if (candRoot) {
      if (!lastEmailCandidates.length) {
        candRoot.innerHTML = `<p style="color:var(--mist)">Aucun pour l'instant.</p>`;
      } else {
        candRoot.innerHTML = lastEmailCandidates
          .slice(0, 16)
          .map(
            (c) => `<div class="job-card" style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;align-items:center">
              <div>
                <h4 style="margin:0">${escapeHtml(c.email)}</h4>
                <div class="meta">${escapeHtml(c.patternLabel)}${c.roleMailbox ? " · boîte générique" : ""} · conf. ${
              c.confidence
            }%</div>
              </div>
              <div class="row-actions">
                <button class="btn btn-soft" data-act="pick-email" data-email="${escapeHtml(
                  c.email
                )}" type="button">Sauver contact</button>
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
                <span class="chip chip-ok">${escapeHtml(top?.email || "—")}</span>
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
    $("#ef-domain").value = guess;
    toast(`Suggestion ${guess} — vérifie le vrai domaine`);
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

  function dualMailContact(contact, preferredEmail) {
    const job = state.jobs.find((j) => j.id === contact.jobId) || {
      title: contact.title,
      company: contact.domain,
    };
    const email =
      preferredEmail ||
      contact.chosenEmail ||
      (contact.candidates || []).find((c) => c.preferred)?.email ||
      (contact.candidates || [])[0]?.email;
    const draft = EmailFinder.buildDualOutreach({
      profile: state.profile,
      job,
      contact,
      email,
    });
    Connectors.mailtoDraft(draft);
  }

  function queueJob(jobId) {
    if (state.applyQueue.some((q) => q.jobId === jobId)) {
      toast("Déjà dans la file");
      return;
    }
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const answer = `Bonjour,\n\nCandidature pour ${job.title} chez ${job.company}.\n\n${state.profile.summary || ""}\n\nJe vise un poste internalisé / client final avec ownership. Disponibilité: immédiate pour un échange.\n\n${state.profile.fullName || ""}`;
    state.applyQueue.unshift({
      id: AscendStore.uid("q"),
      jobId,
      answer,
      at: Date.now(),
    });
    persist();
    toast("Ajouté à Apply Queue");
    render();
  }

  function addJobFromForm() {
    const job = {
      id: AscendStore.uid("job"),
      title: $("#job-title").value.trim(),
      company: $("#job-company").value.trim(),
      location: $("#job-location").value.trim(),
      employerType: $("#job-type").value,
      status: "saved",
      url: $("#job-url").value.trim(),
      description: $("#job-desc").value.trim(),
      tags: $("#job-tags").value
        .split(/,/)
        .map((s) => s.trim())
        .filter(Boolean),
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
    toast("Offre ajoutée");
    render();
  }

  function renderConnectors() {
    $("#gmail-client-id").value = state.connectors.gmailClientId || "";
    $("#linkedin-client-id").value = state.connectors.linkedinClientId || "";
    $("#gmail-status").textContent = state.connectors.gmailConnected || Connectors.getStoredToken()
      ? "Session token présente"
      : "Non connecté (import / mailto OK)";
    $("#linkedin-status").textContent = state.connectors.linkedinConnected
      ? "Connecté"
      : "Non connecté (coller le profil)";
    $("#gemini-last").textContent = state.connectors.lastGeminiImportAt
      ? new Date(state.connectors.lastGeminiImportAt).toLocaleString()
      : "Jamais";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    renderDashboard();
    renderProfile();
    renderAccelerator();
    renderPasserelles();
    renderCvStudio();
    renderLinkedIn();
    renderPipeline();
    renderApplyQueue();
    renderEmailFinder();
    renderConnectors();
  }

  function bind() {
    $$(".side-link").forEach((a) =>
      a.addEventListener("click", (e) => {
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
    $("#btn-run-ats")?.addEventListener("click", runAts);
    $("#btn-boost-cv")?.addEventListener("click", boostCv);
    $("#btn-add-job")?.addEventListener("click", addJobFromForm);
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
      toast("LinkedIn importé — passerelles & vecteurs recalculés");
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
      toast("Import IA / Gemini fusionné");
    });

    $("#btn-save-connectors")?.addEventListener("click", () => {
      Connectors.saveConfig(state, {
        gmailClientId: $("#gmail-client-id").value,
        linkedinClientId: $("#linkedin-client-id").value,
      });
      persist();
      toast("Client IDs sauvés (localStorage)");
    });

    $("#btn-connect-gmail")?.addEventListener("click", () => {
      const id = state.connectors.gmailClientId || $("#gmail-client-id").value.trim();
      if (!id) {
        toast("Ajoute un Google Client ID d'abord");
        return;
      }
      const redirect = window.location.href.split("#")[0];
      window.location.href = Connectors.buildGmailAuthUrl(id, redirect);
    });

    $("#btn-connect-linkedin")?.addEventListener("click", () => {
      const id = state.connectors.linkedinClientId || $("#linkedin-client-id").value.trim();
      if (!id) {
        toast("Ajoute un LinkedIn Client ID d'abord");
        return;
      }
      const redirect = window.location.href.split("#")[0];
      window.location.href = Connectors.buildLinkedInAuthUrl(id, redirect);
    });

    $("#btn-export-json")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ascendos-profile.json";
      a.click();
    });

    $("#btn-import-json")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        state = AscendStore.defaultState();
        state = { ...state, ...JSON.parse(text) };
        persist();
        render();
        toast("Backup JSON importé");
      } catch {
        toast("JSON invalide");
      }
    });

    $("#accel-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "queue") queueJob(btn.dataset.id);
      if (btn.dataset.act === "status") {
        const job = state.jobs.find((j) => j.id === btn.dataset.id);
        if (job) {
          job.status = btn.dataset.status;
          persist();
          render();
        }
      }
    });

    $("#apply-list")?.addEventListener("click", (e) => {
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
        Connectors.mailtoDraft({
          to: "",
          subject: draft.subject,
          body: `${draft.body}\n\n---\nRéponses formulaire ATS/CRM:\n${item.answer}`,
        });
        persist();
      }
      if (btn.dataset.act === "mail-contact") {
        const contact = (state.contacts || []).find((c) => c.id === btn.dataset.cid);
        if (contact) dualMailContact(contact);
      }
      if (btn.dataset.act === "done") {
        if (job) job.status = "applied";
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
    $("#btn-guess-emails")?.addEventListener("click", runEmailGuess);
    $("#btn-guess-domain")?.addEventListener("click", guessDomainForJob);

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
        const draft = EmailFinder.buildDualOutreach({
          profile: state.profile,
          job: job || { title: title || "le poste", company: $("#ef-domain")?.value || "" },
          contact: { fullName, role },
          email,
        });
        Connectors.mailtoDraft(draft);
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
  ensureSeed();
  const token = Connectors.captureImplicitTokenFromHash();
  if (token) {
    state.connectors.gmailConnected = true;
    persist();
    toast("Gmail OAuth: token reçu (session)");
  }
  bind();
  const initial = (location.hash || "#dashboard").replace("#", "") || "dashboard";
  navigate(initial);
})();
