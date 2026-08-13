/**
 * AutoFill CRM / portals — map AscendOS profile (LinkedIn + Workspace/Gemini AI)
 * onto common ATS field names and generate fill packs + bookmarklet.
 *
 * Honest scope on GitHub Pages: we cannot inject into sites from our origin.
 * The bookmarklet / fill-pack runs ON the career page the user is viewing.
 */
const AutoFill = (() => {
  /** Canonical profile → many ATS aliases */
  const FIELD_ALIASES = {
    first_name: [
      "first_name",
      "firstname",
      "firstName",
      "first-name",
      "candidate.firstName",
      "job_application_first_name",
      "Input_FirstName",
      "prenom",
      "prénom",
    ],
    last_name: [
      "last_name",
      "lastname",
      "lastName",
      "last-name",
      "candidate.lastName",
      "job_application_last_name",
      "Input_LastName",
      "nom",
      "name_family",
    ],
    full_name: ["name", "full_name", "fullName", "candidate_name", "applicantName", "nom_complet"],
    email: [
      "email",
      "email_address",
      "emailAddress",
      "candidate.email",
      "job_application_email",
      "Input_Email",
      "courriel",
      "mail",
    ],
    phone: [
      "phone",
      "phone_number",
      "phoneNumber",
      "mobile",
      "tel",
      "telephone",
      "candidate.phone",
      "job_application_phone",
      "Input_Phone",
    ],
    linkedin: [
      "linkedin",
      "linkedin_url",
      "linkedinUrl",
      "linkedIn",
      "social_linkedin",
      "profile_url",
      "urls[LinkedIn]",
    ],
    location: ["location", "city", "address", "ville", "candidate.location", "geo", "current_location"],
    work_arrangement: [
      "work_arrangement",
      "work_mode",
      "remote",
      "teletravail",
      "workplace_type",
      "work_type",
      "hybrid",
      "onsite",
      "modality",
      "modalite",
    ],
    preferred_locations: ["preferred_locations", "preferred_cities", "desired_location", "target_location"],
    headline: ["headline", "title", "job_title", "current_title", "poste", "titre"],
    summary: [
      "summary",
      "about",
      "cover_letter",
      "coverLetter",
      "message",
      "additional_information",
      "comments",
      "motivation",
      "lettre",
    ],
    resume_text: ["resume", "cv", "experience", "work_history", "background"],
    salary: ["salary", "salary_expectation", "compensation", "pretention", "prétentions", "expected_salary"],
    website: ["website", "portfolio", "personal_url", "github", "site"],
    country: ["country", "pays", "country_code"],
  };

  const PORTALS = [
    {
      id: "greenhouse",
      label: "Greenhouse",
      hosts: ["greenhouse.io", "boards.greenhouse.io"],
      notes: "Champs name / email / phone / resume classiques + custom questions.",
    },
    {
      id: "lever",
      label: "Lever",
      hosts: ["lever.co", "jobs.lever.co"],
      notes: "Formulaire apply standard ; LinkedIn souvent demandé.",
    },
    {
      id: "workday",
      label: "Workday",
      hosts: ["myworkdayjobs.com", "workday.com"],
      notes: "Multi-étapes ; autofill aide sur identité + expérience textuelle.",
    },
    {
      id: "smartrecruiters",
      label: "SmartRecruiters",
      hosts: ["smartrecruiters.com", "jobs.smartrecruiters.com"],
      notes: "Portail entreprise fréquent en Europe.",
    },
    {
      id: "taleo",
      label: "Oracle Taleo",
      hosts: ["taleo.net", "oraclecloud.com"],
      notes: "Formulaires longs ; pack identité + résumé critique.",
    },
    {
      id: "successfactors",
      label: "SAP SuccessFactors",
      hosts: ["successfactors", "sap.com"],
      notes: "Grands groupes ; étapes multiples.",
    },
    {
      id: "icims",
      label: "iCIMS",
      hosts: ["icims.com"],
      notes: "ATS US / international.",
    },
    {
      id: "ashby",
      label: "Ashby",
      hosts: ["ashbyhq.com", "jobs.ashbyhq.com"],
      notes: "Startups / scale-ups.",
    },
    {
      id: "teamtailor",
      label: "Teamtailor",
      hosts: ["teamtailor.com"],
      notes: "Très utilisé en Europe / startups FR.",
    },
    {
      id: "welcome",
      label: "Welcome to the Jungle",
      hosts: ["welcometothejungle.com", "wttj.co"],
      notes: "Candidature + profil ; coller résumé / lettre.",
    },
    {
      id: "indeed",
      label: "Indeed / Easy Apply",
      hosts: ["indeed.com", "indeed.fr"],
      notes: "Easy Apply — identité + CV.",
    },
    {
      id: "linkedin",
      label: "LinkedIn Easy Apply",
      hosts: ["linkedin.com"],
      notes: "Complète avec profil AscendOS si champs additionnels.",
    },
    {
      id: "generic",
      label: "Portail carrière générique",
      hosts: [],
      notes: "Heuristique name/id/placeholder sur n'importe quel form.",
    },
  ];

  function splitName(fullName) {
    const parts = String(fullName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return { first: "", last: "" };
    if (parts.length === 1) return { first: parts[0], last: parts[0] };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  /**
   * Build canonical fill values from LinkedIn + AI vault profile.
   */
  function buildFillPack(profile, job = null, opts = {}) {
    const { first, last } = splitName(profile.fullName);
    const cover =
      opts.cover ||
      [
        profile.summary || "",
        job
          ? `\n\nCandidature pour « ${job.title} » chez ${job.company}.`
          : "",
        profile.careerGoal ? `\nObjectif : ${profile.careerGoal}` : "",
      ]
        .join("")
        .trim();

    const experienceText = [
      ...(profile.experiences || []),
      profile.summary || "",
      (profile.skills || []).length ? `Skills: ${(profile.skills || []).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const values = {
      first_name: first,
      last_name: last,
      full_name: profile.fullName || `${first} ${last}`.trim(),
      email: profile.email || "",
      phone: profile.phone || "",
      linkedin: profile.linkedinUrl || "",
      location: profile.location || "",
      work_arrangement:
        typeof WorkPrefs !== "undefined" ? WorkPrefs.summaryText(profile) : "",
      preferred_locations: (profile.workPrefs?.preferredLocations || []).join(", "),
      headline: profile.headline || "",
      summary: cover,
      resume_text: experienceText,
      salary: profile.salaryExpectation || "",
      website: profile.website || "",
      country: profile.country || "France",
      skills: (profile.skills || []).join(", "),
      source: "AscendOS",
      job_title_target: job?.title || "",
      company_target: job?.company || "",
    };

    // Flatten aliases → value for consumers
    const byAlias = {};
    for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
      const val = values[canon];
      if (val == null || val === "") continue;
      for (const a of aliases) byAlias[a.toLowerCase()] = val;
      byAlias[canon] = val;
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      portalHints: PORTALS.map((p) => ({ id: p.id, label: p.label })),
      values,
      byAlias,
      aiProvenance: {
        linkedin: Boolean(profile.linkedinUrl || profile.headline),
        aiVault: (profile.aiImports || []).length > 0,
        lastAiImport: profile.aiImports?.[0]?.at || null,
      },
    };
  }

  function detectPortal(url = "") {
    const u = String(url || "").toLowerCase();
    for (const p of PORTALS) {
      if (p.hosts.some((h) => u.includes(h))) return p;
    }
    return PORTALS.find((p) => p.id === "generic");
  }

  /**
   * Bookmarklet source — fills inputs/textareas/selects by name/id/placeholder/aria/label.
   * Profile pack is embedded as JSON.
   */
  function buildBookmarklet(fillPack) {
    const payload = JSON.stringify(fillPack.values);
    const aliases = JSON.stringify(
      Object.fromEntries(
        Object.entries(FIELD_ALIASES).map(([k, arr]) => [k, arr.map((a) => a.toLowerCase())])
      )
    );

    const code = `(function(){
var V=${payload};
var A=${aliases};
function n(s){return (s||'').toLowerCase().normalize('NFD').replace(/\\p{M}/gu,'').replace(/[^a-z0-9]+/g,'');}
function set(el,val){
  if(val==null||val==='')return false;
  var tag=(el.tagName||'').toLowerCase();
  if(tag==='select'){
    var opts=[].slice.call(el.options||[]);
    var hit=opts.find(function(o){return n(o.text)===n(val)||n(o.value)===n(val);});
    if(!hit) hit=opts.find(function(o){return n(o.text).indexOf(n(val))>=0;});
    if(hit){el.value=hit.value;}
  } else { el.value=val; }
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}
function score(el,canon){
  var bag=[el.name,el.id,el.placeholder,el.getAttribute('aria-label'),el.getAttribute('autocomplete'),el.dataset.qa,el.dataset.test];
  var lab=el.id?document.querySelector('label[for="'+el.id+'"]'):null;
  if(lab) bag.push(lab.textContent);
  var t=n(bag.filter(Boolean).join(' '));
  var aliases=A[canon]||[];
  var s=0;
  aliases.forEach(function(a){ if(t.indexOf(n(a))>=0) s+=3; });
  if(t.indexOf(n(canon))>=0) s+=2;
  return s;
}
var need=['first_name','last_name','email','phone','linkedin','location','summary','salary','website'];
need.forEach(function(k){
  if(!V[k]||String(V[k]).trim()===''){
    var q={first_name:'Prénom ?',last_name:'Nom ?',email:'Email ?',phone:'Téléphone ?',linkedin:'URL profil public ?',location:'Ville ?',summary:'Lettre / message ?',salary:'Prétentions ?',website:'Site / portfolio ?'}[k]||(k+' ?');
    var a=window.prompt('AscendOS · donnée manquante\\n'+q,'');
    if(a!=null&&String(a).trim()){V[k]=String(a).trim(); if(k==='first_name'||k==='last_name'){V.full_name=((V.first_name||'')+' '+(V.last_name||'')).trim();}}
  }
});
var filled=0, asked=0, map={
  first_name:V.first_name,last_name:V.last_name,full_name:V.full_name,email:V.email,phone:V.phone,
  linkedin:V.linkedin,location:V.location,headline:V.headline,summary:V.summary,resume_text:V.resume_text,
  salary:V.salary,website:V.website,country:V.country
};
var nodes=[].slice.call(document.querySelectorAll('input,textarea,select'));
Object.keys(map).forEach(function(canon){
  var best=null,bestS=0;
  nodes.forEach(function(el){
    if(el.type==='hidden'||el.type==='file'||el.type==='checkbox'||el.type==='radio'||el.disabled) return;
    var s=score(el,canon);
    if(s>bestS){bestS=s;best=el;}
  });
  if(best && bestS>=2 && set(best,map[canon])) filled++;
});
nodes.forEach(function(el){
  if(el.type==='hidden'||el.type==='file'||el.disabled) return;
  if(el.value&&String(el.value).trim()) return;
  if(!(el.required||el.getAttribute('aria-required')==='true')) return;
  var lab=el.id?document.querySelector('label[for="'+el.id+'"]'):null;
  var label=(lab&&lab.textContent)||el.placeholder||el.name||el.id||'Champ requis';
  var a=window.prompt('AscendOS · champ requis vide sur cette page\\n'+String(label).trim().slice(0,80),'');
  asked++;
  if(a!=null&&String(a).trim()){ set(el,String(a).trim()); filled++; }
});
alert('AscendOS AutoFill: '+filled+' champ(s) · '+asked+' demande(s) interactive(s). Vérifie avant envoi — pas de submit auto.');
})();`;

    return `javascript:${encodeURIComponent(code)}`;
  }

  /** Fields missing before opening a portal */
  function gapReport(profile) {
    if (typeof PublicEnrich !== "undefined") return PublicEnrich.missingForAutofill(profile);
    return [];
  }

  function exportJson(fillPack) {
    return JSON.stringify(fillPack, null, 2);
  }

  function exportCsv(fillPack) {
    const rows = [["field", "value"]];
    for (const [k, v] of Object.entries(fillPack.values || {})) {
      rows.push([k, String(v).replace(/\n/g, " / ")]);
    }
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  /** Human checklist per portal */
  function portalChecklist(portalId, fillPack) {
    const v = fillPack.values;
    const base = [
      `Nom : ${v.full_name || "—"}`,
      `Email : ${v.email || "—"}`,
      `Téléphone : ${v.phone || "—"}`,
      `LinkedIn : ${v.linkedin || "—"}`,
      `Localisation : ${v.location || "—"}`,
    ];
    const extra = {
      workday: ["Prépare expérience en texte (Workday multi-pages)", "CV PDF à uploader manuellement"],
      greenhouse: ["Resume file upload manuel", "Custom questions : revoir Apply Queue"],
      linkedin: ["Easy Apply : vérifie chaque écran", "Ne pas auto-submit"],
      welcome: ["Lettre / message = summary orienté"],
    };
    return [...base, ...(extra[portalId] || ["Upload CV manuel si demandé", "Relire avant Submit"])];
  }

  return {
    FIELD_ALIASES,
    PORTALS,
    buildFillPack,
    detectPortal,
    buildBookmarklet,
    exportJson,
    exportCsv,
    portalChecklist,
    splitName,
    gapReport,
  };
})();

window.AutoFill = AutoFill;
