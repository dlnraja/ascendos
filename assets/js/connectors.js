/**
 * Connectors — Gmail / LinkedIn OAuth stubs + local helpers.
 * Tokens stay in the browser; real send needs optional functions/ backend.
 */
const Connectors = (() => {
  const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.compose openid email profile";
  const LI_SCOPES = "openid profile email";

  function saveConfig(state, { gmailClientId, linkedinClientId }) {
    state.connectors.gmailClientId = (gmailClientId || "").trim();
    state.connectors.linkedinClientId = (linkedinClientId || "").trim();
    return state;
  }

  function buildGmailAuthUrl(clientId, redirectUri) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: GMAIL_SCOPES,
      include_granted_scopes: "true",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  function buildLinkedInAuthUrl(clientId, redirectUri) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: LI_SCOPES,
      state: "ascendos_li",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  function captureImplicitTokenFromHash() {
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash || !hash.includes("access_token")) return null;
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    if (!token) return null;
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
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return token;
  }

  function getStoredToken() {
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
    const url = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(
      subject || ""
    )}&body=${encodeURIComponent(body || "")}`;
    window.open(url, "_blank");
  }

  function buildRecruiterOutreach(profile, job) {
    const name = profile.fullName || "candidat";
    const role = job?.title || "le poste";
    const company = job?.company || "votre entreprise";
    return {
      subject: `${role} — profil ${name} (client final / ownership)`,
      body: `Bonjour,\n\nJe vous contacte au sujet de « ${role} » chez ${company}.\n\nAprès plusieurs années en environnement ESN / projet, je vise désormais un poste internalisé chez un grand groupe ou éditeur, avec plus d'ownership produit et d'impact.\n\nEn 2 lignes : ${profile.headline || "profil tech / produit"}.\n\n${(profile.summary || "").slice(0, 420)}\n\nSeriez-vous ouvert(e) à un échange de 15 minutes ?\n\nBien cordialement,\n${name}\n${profile.email || ""}\n${profile.linkedinUrl || ""}`,
    };
  }

  return {
    saveConfig,
    buildGmailAuthUrl,
    buildLinkedInAuthUrl,
    captureImplicitTokenFromHash,
    getStoredToken,
    mailtoDraft,
    buildRecruiterOutreach,
  };
})();

window.Connectors = Connectors;
