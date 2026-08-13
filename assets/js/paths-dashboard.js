/**
 * Interactive career-evolution dashboard (passerelles / vectors / breaks).
 * Visual-first: constellation + meters + step tiles — not a text wall.
 */
(() => {
  const svg = document.getElementById("paths-svg");
  const sheet = document.getElementById("paths-sheet");
  const rail = document.getElementById("paths-rail");
  const legend = document.getElementById("paths-legend");

  let mode = "bridges";
  let selectedFamily = null;
  let selectedBridgeIdx = null;
  let selectedVectorId = null;
  let selectedBreakId = null;

  const SHORT = {
    tech: "Tech",
    sales: "Vente",
    marketing: "Marketing",
    finance: "Finance",
    hr: "RH",
    ops: "Ops",
    healthcare: "Santé",
    education: "Éducation",
    legal: "Legal",
    creative: "Créatif",
    public: "Public",
    hospitality: "Hôtellerie",
    trades: "Métiers",
    customer: "Client",
    management: "Management",
    consulting: "Conseil",
  };

  const LEVEL = {
    high: 92,
    "medium-high": 78,
    medium: 58,
    "low-medium": 42,
    low: 28,
  };

  function levelPct(v) {
    return LEVEL[v] ?? 50;
  }

  function levelLabel(v) {
    return (
      {
        high: "Fort",
        "medium-high": "Élevé",
        medium: "Moyen",
        "low-medium": "Modéré",
        low: "Léger",
      }[v] || "—"
    );
  }

  function familyPos(i, n, cx = 450, cy = 320, r = 235) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  function clearSvg() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function el(name, attrs = {}, text) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }

  function defs() {
    const d = el("defs");
    const g = el("linearGradient", { id: "bridgeGrad", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
    g.appendChild(el("stop", { offset: "0%", "stop-color": "#ff6b4a" }));
    g.appendChild(el("stop", { offset: "100%", "stop-color": "#c8f547" }));
    d.appendChild(g);
    svg.appendChild(d);
  }

  function showSheet({ kicker, title, meters, steps, skills, ctaHref }) {
    sheet.hidden = false;
    document.getElementById("sheet-kicker").textContent = kicker;
    document.getElementById("sheet-title").textContent = title;
    document.getElementById("sheet-cta").href = ctaHref || "app.html#passerelles";

    const metersEl = document.getElementById("sheet-meters");
    metersEl.innerHTML = (meters || [])
      .map(
        (m) => `<div class="meter">
        <div class="meter-top"><span>${m.label}</span><span>${m.valueLabel}</span></div>
        <div class="meter-bar"><i style="width:${m.pct}%"></i></div>
      </div>`
      )
      .join("");
    // reflow animation
    requestAnimationFrame(() => {
      metersEl.querySelectorAll("i").forEach((i) => {
        const w = i.style.width;
        i.style.width = "0";
        requestAnimationFrame(() => {
          i.style.width = w;
        });
      });
    });

    document.getElementById("sheet-steps").innerHTML = (steps || [])
      .map(
        (s, i) => `<div class="step-tile">
        <div class="step-num">${i + 1}</div>
        <div><strong>${s.title}</strong><span>${s.body}</span></div>
      </div>`
      )
      .join("");

    document.getElementById("sheet-skills").innerHTML = (skills || [])
      .map((s) => `<em>${s}</em>`)
      .join("");
  }

  function hideSheet() {
    sheet.hidden = true;
  }

  function renderBridgesMap() {
    clearSvg();
    defs();
    const families = Passerelles.FAMILIES;
    const bridges = Passerelles.BRIDGES;
    const pos = {};
    families.forEach((f, i) => {
      pos[f.id] = familyPos(i, families.length);
    });

    svg.appendChild(el("circle", { class: "orbit-ring", cx: 450, cy: 320, r: 235 }));
    svg.appendChild(el("circle", { class: "orbit-ring", cx: 450, cy: 320, r: 160, style: "animation-duration:36s" }));
    svg.appendChild(el("circle", { class: "pulse-core", cx: 450, cy: 320, r: 30 }));
    svg.appendChild(
      el("text", {
        x: 450,
        y: 325,
        class: "node-label",
        "font-size": "13",
        fill: "#c8f547",
      }, "TOI")
    );

    const linesG = el("g", { class: "bridges-layer" });
    bridges.forEach((b, idx) => {
      const a = pos[b.from];
      const c = pos[b.to];
      if (!a || !c) return;
      const mx = (a.x + c.x) / 2 + (a.y - c.y) * 0.08;
      const my = (a.y + c.y) / 2 + (c.x - a.x) * 0.08;
      const path = el("path", {
        class: `bridge-line${selectedBridgeIdx === idx ? " is-hot" : ""}${
          selectedFamily && b.from !== selectedFamily && b.to !== selectedFamily ? " is-dim" : ""
        }`,
        d: `M ${a.x} ${a.y} Q ${mx} ${my} ${c.x} ${c.y}`,
        "data-idx": String(idx),
      });
      path.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedBridgeIdx = idx;
        selectedFamily = b.from;
        openBridge(b, idx);
        render();
      });
      linesG.appendChild(path);
    });
    svg.appendChild(linesG);

    families.forEach((f) => {
      const p = pos[f.id];
      const g = el("g", {
        class: `node-hit${selectedFamily === f.id ? " is-active" : ""}${
          selectedBridgeIdx != null && bridges[selectedBridgeIdx]?.from === f.id ? " is-from" : ""
        }${selectedBridgeIdx != null && bridges[selectedBridgeIdx]?.to === f.id ? " is-to" : ""}`,
        transform: `translate(${p.x}, ${p.y})`,
      });
      g.appendChild(el("circle", { class: "node-disk", r: "28", cx: "0", cy: "0" }));
      g.appendChild(el("text", { class: "node-label", y: "4" }, SHORT[f.id] || f.label.slice(0, 8)));
      g.addEventListener("click", () => {
        selectedFamily = f.id;
        selectedBridgeIdx = null;
        const outs = bridges.filter((b) => b.from === f.id);
        showSheet({
          kicker: "Famille",
          title: f.label,
          meters: [
            { label: "Passerelles sortantes", valueLabel: String(outs.length), pct: Math.min(100, outs.length * 18) },
          ],
          steps: [
            { title: "Repère ton ancrage", body: "Tes preuves actuelles vivent surtout ici." },
            { title: "Choisis un pont", body: "Clique un trait coloré ou une carte ci-dessous." },
            { title: "Active le cap", body: "Ouvre l’atelier pour scorer les offres sur ce chemin." },
          ],
          skills: outs.slice(0, 4).map((b) => b.title.split("→").pop().trim()),
          ctaHref: "app.html#passerelles",
        });
        render();
      });
      svg.appendChild(g);
    });

    legend.innerHTML = `
      <span>Disque = famille</span>
      <span>Trait = passerelle</span>
      <span style="color:#c8f547">Lime = départ</span>
      <span style="color:#ff6b4a">Corail = arrivée</span>`;
  }

  function openBridge(b) {
    showSheet({
      kicker: `${SHORT[b.from] || b.from} → ${SHORT[b.to] || b.to}`,
      title: b.title,
      meters: [
        { label: "Levier carrière", valueLabel: levelLabel(b.leverage), pct: levelPct(b.leverage) },
        { label: "Potentiel paie", valueLabel: levelLabel(b.payLift), pct: levelPct(b.payLift) },
      ],
      steps: [
        { title: "Ce que tu transfert", body: (b.transferable || []).slice(0, 3).join(" · ") || "Compétences déjà prouvées." },
        { title: "Angle CV honnête", body: b.cvAngle },
        { title: "Coup de chance", body: b.breakChance || "Cherche un sponsor / une réorg / un ex-client." },
        { title: "Passage à l’acte", body: "Filtre les offres sur ce pont dans l’app, puis pack candidature." },
      ],
      skills: b.transferable || [],
      ctaHref: "app.html#passerelles",
    });
  }

  function renderVectorsMap() {
    clearSvg();
    defs();
    const cats = CareerVectors.CATEGORIES;
    const vectors = CareerVectors.VECTORS;
    const cx = 450;
    const cy = 320;

    cats.forEach((c, i) => {
      const r = 110 + i * 48;
      svg.appendChild(el("circle", { class: "orbit-ring", cx, cy, r, style: `animation-duration:${40 + i * 8}s` }));
      svg.appendChild(
        el(
          "text",
          {
            x: cx,
            y: cy - r + 4,
            class: "node-label",
            "font-size": "10",
            fill: "#b7cfc7",
            opacity: "0.7",
          },
          c.label
        )
      );
    });

    svg.appendChild(el("circle", { class: "pulse-core", cx, cy, r: 26 }));
    svg.appendChild(el("text", { x: cx, y: cy + 5, class: "node-label", "font-size": "12", fill: "#c8f547" }, "CAP"));

    vectors.forEach((v, i) => {
      const catIdx = Math.max(0, cats.findIndex((c) => c.id === v.category));
      const r = 110 + catIdx * 48;
      const siblings = vectors.filter((x) => x.category === v.category);
      const si = siblings.findIndex((x) => x.id === v.id);
      const a = -Math.PI / 2 + ((si + 0.5) / Math.max(1, siblings.length)) * Math.PI * 2 + catIdx * 0.15;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const g = el("g", {
        class: `node-hit${selectedVectorId === v.id ? " is-active" : ""}`,
        transform: `translate(${x}, ${y})`,
      });
      g.appendChild(el("circle", { class: "node-disk", r: "22", cx: "0", cy: "0" }));
      g.appendChild(el("text", { class: "node-label", y: "3", "font-size": "9" }, (v.short || v.label).slice(0, 10)));
      g.addEventListener("click", () => {
        selectedVectorId = v.id;
        openVector(v);
        render();
      });
      svg.appendChild(g);
    });

    legend.innerHTML = `<span>Anneaux = catégories</span><span>Points = vecteurs d’upgrade</span>`;
  }

  function openVector(v) {
    const play = String(v.playbook || "")
      .split(/(?<=\.)\s+/)
      .filter(Boolean)
      .slice(0, 3);
    showSheet({
      kicker: CareerVectors.CATEGORIES.find((c) => c.id === v.category)?.label || "Vecteur",
      title: v.label,
      meters: [{ label: "Priorité signal", valueLabel: v.short || "Upgrade", pct: 72 + (v.id.length % 20) }],
      steps: [
        { title: "Intention", body: v.blurb },
        ...(play.length
          ? play.map((p, i) => ({ title: `Mouvement ${i + 1}`, body: p }))
          : [{ title: "Playbook", body: v.playbook || "Active ce vecteur dans l’accélérateur." }]),
      ],
      skills: (v.positive || []).slice(0, 6),
      ctaHref: "app.html#accelerator",
    });
  }

  function renderBreaksMap() {
    clearSvg();
    defs();
    const breaks = Passerelles.BREAKS || [];
    const cx = 450;
    const cy = 320;
    svg.appendChild(el("circle", { class: "orbit-ring", cx, cy, r: 200 }));
    svg.appendChild(el("circle", { class: "pulse-core", cx, cy, r: 34 }));
    svg.appendChild(el("text", { x: cx, y: cy + 5, class: "node-label", "font-size": "12", fill: "#ff6b4a" }, "BREAK"));

    breaks.forEach((b, i) => {
      const p = familyPos(i, breaks.length, cx, cy, 200);
      const g = el("g", {
        class: `node-hit${selectedBreakId === b.id ? " is-active is-to" : ""}`,
        transform: `translate(${p.x}, ${p.y})`,
      });
      g.appendChild(el("circle", { class: "node-disk", r: "26", cx: "0", cy: "0" }));
      g.appendChild(el("text", { class: "node-label", y: "4", "font-size": "10" }, (b.label || b.id).slice(0, 11)));
      g.addEventListener("click", () => {
        selectedBreakId = b.id;
        showSheet({
          kicker: "Coup de levier",
          title: b.label || b.id,
          meters: [
            {
              label: "Accélération paie",
              valueLabel: levelLabel(b.payAccel),
              pct: levelPct(b.payAccel),
            },
          ],
          steps: [
            { title: "Pourquoi ça marche", body: b.why || "Détecte ce pattern dans les offres et ton réseau." },
            {
              title: "Indices",
              body: (b.detect || []).slice(0, 5).join(" · ") || "Mots-clés liés à ce break.",
            },
            { title: "Action", body: "Quand le signal apparaît, accélère (file PRIME + outreach)." },
          ],
          skills: b.detect || [],
          ctaHref: "app.html#fresh",
        });
        render();
      });
      svg.appendChild(g);
    });

    legend.innerHTML = `<span>Breaks = accélérateurs de timing</span><span>Pas un mensonge — un moment à saisir</span>`;
  }

  function renderRail() {
    let cards = [];
    if (mode === "bridges") {
      const list = selectedFamily
        ? Passerelles.BRIDGES.filter((b) => b.from === selectedFamily || b.to === selectedFamily)
        : Passerelles.BRIDGES;
      cards = list.slice(0, 12).map((b, idx) => {
        const realIdx = Passerelles.BRIDGES.indexOf(b);
        return {
          active: selectedBridgeIdx === realIdx,
          meta: `${SHORT[b.from]} → ${SHORT[b.to]}`,
          title: b.title,
          sub: `Levier ${levelLabel(b.leverage)} · Paie ${levelLabel(b.payLift)}`,
          onClick: () => {
            selectedBridgeIdx = realIdx;
            selectedFamily = b.from;
            openBridge(b);
            render();
          },
        };
      });
    } else if (mode === "vectors") {
      cards = CareerVectors.VECTORS.map((v) => ({
        active: selectedVectorId === v.id,
        meta: CareerVectors.CATEGORIES.find((c) => c.id === v.category)?.label || "",
        title: v.short || v.label,
        sub: v.blurb,
        onClick: () => {
          selectedVectorId = v.id;
          openVector(v);
          render();
        },
      }));
    } else {
      cards = (Passerelles.BREAKS || []).map((b) => ({
        active: selectedBreakId === b.id,
        meta: `Paie ${levelLabel(b.payAccel)}`,
        title: b.label || b.id,
        sub: b.why || "",
        onClick: () => {
          selectedBreakId = b.id;
          showSheet({
            kicker: "Coup de levier",
            title: b.label || b.id,
            meters: [
              {
                label: "Accélération paie",
                valueLabel: levelLabel(b.payAccel),
                pct: levelPct(b.payAccel),
              },
            ],
            steps: [
              { title: "Pourquoi ça marche", body: b.why || "" },
              { title: "Indices", body: (b.detect || []).slice(0, 5).join(" · ") },
              { title: "Action", body: "Accélère dès que le signal est là." },
            ],
            skills: b.detect || [],
            ctaHref: "app.html#fresh",
          });
          render();
        },
      }));
    }

    rail.innerHTML = "";
    cards.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rail-card${c.active ? " is-active" : ""}`;
      btn.innerHTML = `<div class="rail-meta"><b>${escapeHtml(c.meta)}</b></div>
        <strong>${escapeHtml(c.title)}</strong>
        <span>${escapeHtml(c.sub)}</span>`;
      btn.addEventListener("click", c.onClick);
      rail.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    if (mode === "bridges") renderBridgesMap();
    else if (mode === "vectors") renderVectorsMap();
    else renderBreaksMap();
    renderRail();
  }

  document.querySelectorAll(".paths-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      document.querySelectorAll(".paths-mode").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      selectedBridgeIdx = null;
      selectedVectorId = null;
      selectedBreakId = null;
      hideSheet();
      render();
    });
  });

  document.getElementById("paths-sheet-close")?.addEventListener("click", hideSheet);

  // boot — open a strong default path
  render();
  const firstHigh = Passerelles.BRIDGES.find((b) => b.leverage === "high");
  if (firstHigh) {
    selectedBridgeIdx = Passerelles.BRIDGES.indexOf(firstHigh);
    selectedFamily = firstHigh.from;
    openBridge(firstHigh);
    render();
  }
})();
