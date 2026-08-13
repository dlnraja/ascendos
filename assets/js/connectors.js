/**
 * Connectors — one-click deep links + magic links (local-first).
 * Magic payload stays in the URL fragment / clipboard; secrets never leave the browser.
 */
const Connectors = (() => {
  const GMAIL_SCOPES =
    "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose openid email profile";
  const LI_SCOPES = "openid profile email";
  const MAGIC_PREFIX = "ml.";

  const GEMINI_PROMPT = `À partir de mon CV / LinkedIn, produis un profil JSON AscendOS avec :
fullName, headline, summary, email, phone, location, yearsExp, skills[], experiences[{title,company,bullets[]}], languages[], target_roles[], career_goal, linkedinUrl.
Réponds UNIQUEMENT en JSON valide.`;

  function saveConfig(state, { gmailClientId, linkedinClientId }) {
    state.connectors.gmailClientId = (gmailClientId || "").trim();
    state.connectors.linkedinClientId = (linkedinClientId || "").trim();
    return state;
  }

  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlDecode(str) {
    const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /** Compact magic payload — prefer encrypted via AscendSecurity.sealMagicPayload. */
  function buildMagicPayload(connectors = {}) {
    const p = { v: 1 };
    if (connectors.gmailClientId) p.g = connectors.gmailClientId;
    if (connectors.linkedinClientId) p.l = connectors.linkedinClientId;
    if (connectors.hunterApiKey) p.h = connectors.hunterApiKey;
    if (connectors.underIaApiKey) p.u = connectors.underIaApiKey;
    if (connectors.underIaApiBase) p.ub = connectors.underIaApiBase;
    if (connectors.adzunaAppId) p.a = connectors.adzunaAppId;
    if (connectors.adzunaAppKey) p.k = connectors.adzunaAppKey;
    if (connectors.aggregateApiBase) p.b = connectors.aggregateApiBase;
    return p;
  }

  function applyMagicPayload(state, payload) {
    if (!payload || typeof payload !== "object") throw new Error("Magic link invalide");
    // secrets object from vault open
    const src = payload.secrets || payload;
    if (src.g) state.connectors.gmailClientId = String(src.g).trim();
    if (src.l) state.connectors.linkedinClientId = String(src.l).trim();
    if (src.h) state.connectors.hunterApiKey = String(src.h).trim();
    if (src.u) state.connectors.underIaApiKey = String(src.u).trim();
    if (src.ub) state.connectors.underIaApiBase = String(src.ub).trim().replace(/\/$/, "");
    if (src.a) state.connectors.adzunaAppId = String(src.a).trim();
    if (src.k) state.connectors.adzunaAppKey = String(src.k).trim();
    if (src.b) state.connectors.aggregateApiBase = String(src.b).trim().replace(/\/$/, "");
    if (src.gmailClientId) state.connectors.gmailClientId = String(src.gmailClientId).trim();
    if (src.linkedinClientId) state.connectors.linkedinClientId = String(src.linkedinClientId).trim();
    if (src.hunterApiKey) state.connectors.hunterApiKey = String(src.hunterApiKey).trim();
    if (src.underIaApiKey) state.connectors.underIaApiKey = String(src.underIaApiKey).trim();
    if (src.underIaApiBase)
      state.connectors.underIaApiBase = String(src.underIaApiBase).trim().replace(/\/$/, "");
    if (src.adzunaAppId) state.connectors.adzunaAppId = String(src.adzunaAppId).trim();
    if (src.adzunaAppKey) state.connectors.adzunaAppKey = String(src.adzunaAppKey).trim();
    if (src.aggregateApiBase)
      state.connectors.aggregateApiBase = String(src.aggregateApiBase).trim().replace(/\/$/, "");
    return state;
  }

  function encodeMagicToken(connectors) {
    return MAGIC_PREFIX + b64urlEncode(JSON.stringify(buildMagicPayload(connectors)));
  }

  async function encodeSecureMagicToken(connectors) {
    if (typeof AscendSecurity === "undefined") return encodeMagicToken(connectors);
    const sealed = await AscendSecurity.sealMagicPayload(connectors);
    return MAGIC_PREFIX + b64urlEncode(JSON.stringify(sealed));
  }

  function parseMagicToken(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    try {
      const u = new URL(s, window.location.origin);
      const q = u.searchParams.get("ml") || u.searchParams.get("magic");
      if (q) s = q;
      else if (u.hash) {
        const h = u.hash.replace(/^#/, "");
        if (h.startsWith(MAGIC_PREFIX) || h.includes("/" + MAGIC_PREFIX)) {
          const idx = h.indexOf(MAGIC_PREFIX);
          s = h.slice(idx);
        }
      }
    } catch {
      /* plain token */
    }
    if (s.startsWith("#")) s = s.slice(1);
    if (s.includes("/" + MAGIC_PREFIX)) s = s.slice(s.indexOf(MAGIC_PREFIX));
    if (!s.startsWith(MAGIC_PREFIX)) {
      try {
        const j = JSON.parse(b64urlDecode(s));
        if (j && (j.v || j.g || j.gmailClientId || j.enc)) return j;
      } catch {
        return null;
      }
      return null;
    }
    try {
      return JSON.parse(b64urlDecode(s.slice(MAGIC_PREFIX.length)));
    } catch {
      return null;
    }
  }

  function magicLinkUrl(connectors) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#${encodeMagicToken(connectors)}`;
  }

  async function secureMagicLinkUrl(connectors) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#${await encodeSecureMagicToken(connectors)}`;
  }

  /** Consume #ml.… from current location; returns payload or null. */
  function captureMagicFromLocation() {
    const hash = (window.location.hash || "").replace(/^#/, "");
    let token = null;
    if (!hash.startsWith(MAGIC_PREFIX) && !hash.includes(MAGIC_PREFIX)) {
      const q = new URLSearchParams(window.location.search).get("ml");
      if (!q) return null;
      token = q.startsWith(MAGIC_PREFIX) ? q : MAGIC_PREFIX + q;
      const payload = parseMagicToken(token);
      if (payload) {
        history.replaceState(null, "", window.location.pathname);
        if (payload.enc || payload.v === 2) {
          try {
            sessionStorage.setItem("ascendos.pendingMagic", token);
          } catch {
            /* ignore */
          }
        }
      }
      return payload;
    }
    const idx = hash.indexOf(MAGIC_PREFIX);
    token = hash.slice(idx).split("&")[0].split("/")[0];
    const payload = parseMagicToken(token);
    if (payload) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (payload.enc || payload.v === 2) {
        try {
          sessionStorage.setItem("ascendos.pendingMagic", token);
        } catch {
          /* ignore */
        }
      }
    }
    return payload;
  }

  function buildGmailAuthUrl(clientId, redirectUri, stateNonce) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: GMAIL_SCOPES,
      include_granted_scopes: "true",
      prompt: "consent",
      state: stateNonce || "ascendos_gmail",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  function buildLinkedInAuthUrl(clientId, redirectUri, stateNonce) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: LI_SCOPES,
      state: stateNonce || "ascendos_li",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  async function captureImplicitTokenFromHash() {
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash || !hash.includes("access_token")) return null;
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const stateNonce = params.get("state");
    // Clear hash immediately (token must not linger in history / Referer)
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) return null;
    if (typeof AscendSecurity !== "undefined") {
      if (stateNonce && !AscendSecurity.consumeOAuthState(stateNonce)) {
        console.warn("[AscendOS] OAuth state mismatch — token discarded");
        return null;
      }
      await AscendSecurity.storeOAuthToken({
        access_token: token,
        expires_in: params.get("expires_in"),
        token_type: params.get("token_type"),
        scope: params.get("scope"),
      });
      return token;
    }
    sessionStorage.setItem(
      "ascendos.oauth",
      JSON.stringify({
        access_token: token,
        expires_in: params.get("expires_in"),
        token_type: params.get("token_type"),
        scope: params.get("scope"),
        at: Date.now(),
      })
    );
    return token;
  }

  async function getStoredToken() {
    if (typeof AscendSecurity !== "undefined") {
      return AscendSecurity.getOAuthToken();
    }
    try {
      const raw = sessionStorage.getItem("ascendos.oauth");
      if (!raw) return null;
      const data = JSON.parse(raw);
      const expMs = Number(data.expires_in || 3600) * 1000;
      if (Date.now() - data.at > expMs - 30_000) return null;
      return data.access_token;
    } catch {
      return null;
    }
  }

  function mailtoDraft({ to, subject, body }) {
    if (typeof LocalStack !== "undefined") {
      return LocalStack.openMailDraft({ to, subject, body });
    }
    const url = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(
      subject || ""
    )}&body=${encodeURIComponent(body || "")}`;
    window.open(url, "_blank");
  }

  /** Prefer user's Gmail API; fall back to mailto. */
  async function sendOrDraft({ to, subject, body, confirm = true } = {}) {
    if (typeof GmailSend === "undefined") {
      mailtoDraft({ to, subject, body });
      return { ok: false, path: "mailto" };
    }
    if (confirm) return GmailSend.sendWithConfirm({ to, subject, body });
    return GmailSend.send({ to, subject, body, mode: "send" });
  }

  function gmailComposeUrl({ to, subject, body }) {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: to || "",
      su: subject || "",
      body: body || "",
    });
    return `https://mail.google.com/mail/?${params}`;
  }

  function openExternal(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /** Catalog of one-click / deep-link actions (no Client ID required for most). */
  function oneClickLinks(profile = {}, draft = null) {
    const li = profile.linkedinUrl || "https://www.linkedin.com/in/me/";
    const outreach = draft || { subject: "", body: "", to: "" };
    return [
      {
        id: "gmail_compose",
        label: "Ouvrir Gmail",
        blurb: "Compose prêt (deep link) — zéro config.",
        href: gmailComposeUrl(outreach),
        tone: "primary",
      },
      {
        id: "gmail_oauth",
        label: "Connecter Gmail (envoi)",
        blurb: "OAuth · scope send — envoie depuis TON Gmail ( AscendOS ne voit pas le mail).",
        action: "oauth_gmail",
        tone: "soft",
      },
      {
        id: "linkedin_profile",
        label: "Ouvrir LinkedIn",
        blurb: "Ton profil (ou /in/me).",
        href: li,
        tone: "primary",
      },
      {
        id: "linkedin_oauth",
        label: "Connecter LinkedIn",
        blurb: "OAuth one-click si Client ID présent.",
        action: "oauth_linkedin",
        tone: "soft",
      },
      {
        id: "gemini",
        label: "Ouvrir vault IA",
        blurb: "Prompt AscendOS copié → colle dans ton IA.",
        href: "https://gemini.google.com/app",
        action: "copy_gemini_prompt",
        tone: "primary",
      },
      {
        id: "hunter",
        label: "Créer une clé email API",
        blurb: "Puis colle-la dans le coffre (réglages avancés).",
        href: "https://hunter.io/users/sign_up",
        tone: "soft",
      },
      {
        id: "adzuna",
        label: "Adzuna API",
        blurb: "APP_ID / KEY gratuits pour Radar frais.",
        href: "https://developer.adzuna.com/",
        tone: "soft",
      },
      {
        id: "google_cloud",
        label: "Créer Client ID Google",
        blurb: "Console OAuth → puis « Copier mon magic link ».",
        href: "https://console.cloud.google.com/apis/credentials",
        tone: "ghost",
      },
      {
        id: "linkedin_dev",
        label: "Créer app LinkedIn",
        blurb: "Developers → Client ID → magic link.",
        href: "https://www.linkedin.com/developers/apps",
        tone: "ghost",
      },
    ];
  }

  function buildRecruiterOutreach(profile, job) {
    const name = profile.fullName || "candidat";
    const role = job?.title || "le poste";
    const company = job?.company || "votre entreprise";
    return {
      subject: `${role} — profil ${name} (client final / ownership)`,
      body: `Bonjour,\n\nJe vous contacte au sujet de « ${role} » chez ${company}.\n\nAprès plusieurs années en environnement ESN / projet, je vise désormais un poste internalisé chez un grand groupe ou éditeur, avec plus d'ownership produit et d'impact.\n\nEn 2 lignes : ${profile.headline || "profil tech / produit"}.\n\n${(profile.summary || "").slice(0, 420)}\n\nSeriez-vous ouvert(e) à un échange de 15 minutes ?\n\nBien cordialement,\n${name}\n${profile.email || ""}\n${profile.linkedinUrl || ""}`,
      to: "",
    };
  }

  return {
    saveConfig,
    buildGmailAuthUrl,
    buildLinkedInAuthUrl,
    captureImplicitTokenFromHash,
    getStoredToken,
    mailtoDraft,
    sendOrDraft,
    gmailComposeUrl,
    openExternal,
    oneClickLinks,
    buildRecruiterOutreach,
    buildMagicPayload,
    applyMagicPayload,
    encodeMagicToken,
    encodeSecureMagicToken,
    parseMagicToken,
    magicLinkUrl,
    secureMagicLinkUrl,
    captureMagicFromLocation,
    GEMINI_PROMPT,
    MAGIC_PREFIX,
  };
})();

window.Connectors = Connectors;
