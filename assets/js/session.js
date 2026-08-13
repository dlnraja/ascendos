/**
 * AscendSession — optional identity (Google / LinkedIn) that stays in the browser.
 * AscendOS has no account database: nothing is sent to an AscendOS server.
 * OAuth talks only to the identity provider from the user's device.
 */
const AscendSession = (() => {
  const KEY = "ascendos.session.v1";

  function empty() {
    return {
      provider: null, // google | linkedin | local
      sub: "",
      email: "",
      name: "",
      picture: "",
      linkedinUrl: "",
      at: null,
    };
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
      if (!raw) return empty();
      return { ...empty(), ...JSON.parse(raw) };
    } catch {
      return empty();
    }
  }

  function save(session, { persistent = true } = {}) {
    const data = { ...empty(), ...session, at: Date.now() };
    const json = JSON.stringify(data);
    sessionStorage.setItem(KEY, json);
    if (persistent) localStorage.setItem(KEY, json);
    else localStorage.removeItem(KEY);
    return data;
  }

  function clear() {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    return empty();
  }

  function isSignedIn(session = load()) {
    return Boolean(session?.provider && (session.email || session.name || session.sub));
  }

  function label(session = load()) {
    if (!isSignedIn(session)) return "Local · aucune session";
    const who = session.email || session.name || session.sub;
    const p =
      session.provider === "google"
        ? "Google"
        : session.provider === "linkedin"
          ? "LinkedIn"
          : "Local";
    return `${p} · ${who}`;
  }

  /** Google userinfo — soft-fail if Google down. */
  async function fromGoogleAccessToken(accessToken) {
    try {
      if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("google_userinfo");
      const fetchFn = typeof AscendResilience !== "undefined" ? AscendResilience.fetch : fetch;
      const res = await fetchFn("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: 8000,
      });
      if (!res.ok) throw new Error(`Google userinfo ${res.status}`);
      const u = await res.json();
      return save({
        provider: "google",
        sub: u.sub || "",
        email: u.email || "",
        name: u.name || "",
        picture: u.picture || "",
        linkedinUrl: "",
      });
    } catch (e) {
      // Keep a minimal local session so the app continues
      return save({
        provider: "local",
        sub: "google_offline",
        email: "",
        name: "Session Google (offline)",
        picture: "",
        linkedinUrl: "",
        note: e.message,
      });
    }
  }

  /** LinkedIn OIDC userinfo — soft-fail if LinkedIn down. */
  async function fromLinkedInAccessToken(accessToken) {
    try {
      const fetchFn = typeof AscendResilience !== "undefined" ? AscendResilience.fetch : fetch;
      const res = await fetchFn("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: 8000,
      });
      if (!res.ok) throw new Error(`LinkedIn userinfo ${res.status}`);
      const u = await res.json();
      return save({
        provider: "linkedin",
        sub: u.sub || "",
        email: u.email || "",
        name: u.name || `${u.given_name || ""} ${u.family_name || ""}`.trim(),
        picture: u.picture || "",
        linkedinUrl: "",
      });
    } catch (e) {
      return save({
        provider: "linkedin",
        sub: "linkedin_offline",
        email: "",
        name: "LinkedIn (offline)",
        picture: "",
        linkedinUrl: "",
        note: e.message,
      });
    }
  }

  /** Bind LinkedIn without AscendOS server — local profile link only. */
  function bindLinkedInLocal({ name, email, linkedinUrl }) {
    return save({
      provider: "linkedin",
      sub: linkedinUrl || email || name || "li_local",
      email: email || "",
      name: name || "",
      picture: "",
      linkedinUrl: linkedinUrl || "",
    });
  }

  /** Optionally fill empty profile fields — never overwrite user edits. */
  function mergeIntoProfile(profile, session = load()) {
    if (!isSignedIn(session)) return profile;
    const p = { ...profile };
    if (!p.fullName && session.name) p.fullName = session.name;
    if (!p.email && session.email) p.email = session.email;
    if (!p.linkedinUrl && session.linkedinUrl) p.linkedinUrl = session.linkedinUrl;
    return p;
  }

  /** Scopes for identity-only session (no Gmail send). */
  const GOOGLE_SESSION_SCOPES = "openid email profile";

  function buildGoogleSessionAuthUrl(clientId, redirectUri, stateNonce) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: GOOGLE_SESSION_SCOPES,
      include_granted_scopes: "true",
      prompt: "select_account",
      state: stateNonce || "ascendos_session_google",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  return {
    empty,
    load,
    save,
    clear,
    isSignedIn,
    label,
    fromGoogleAccessToken,
    fromLinkedInAccessToken,
    bindLinkedInLocal,
    mergeIntoProfile,
    buildGoogleSessionAuthUrl,
    GOOGLE_SESSION_SCOPES,
  };
})();

window.AscendSession = AscendSession;
