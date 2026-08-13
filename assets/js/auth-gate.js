/**
 * AscendAuth — local login gate (password + JWT session + OAuth providers).
 * No AscendOS account DB: credentials & JWT stay on the device.
 */
const AscendAuth = (() => {
  const META_KEY = "ascendos.auth.v1";
  const JWT_KEY = "ascendos.jwt.v1";
  const SEAL_KEY = "ascendos.data.sealed.v1";
  const STORE_KEY = "ascendos.v1";
  const PBKDF2_ITERS = 210_000;
  const JWT_TTL_MS = 8 * 60 * 60 * 1000;

  function b64url(bytes) {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlJson(obj) {
    return b64url(new TextEncoder().encode(JSON.stringify(obj)));
  }

  function fromB64url(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeMeta(patch) {
    const next = { ...readMeta(), ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(next));
    return next;
  }

  function isEnabled() {
    return Boolean(readMeta().requireAuth);
  }

  async function deriveSignKey(passphrase, saltBytes) {
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      base,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }

  async function deriveAesKey(passphrase, saltBytes) {
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function mintJwt(claims, signingKey) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: "ascendos-local",
      iat: now,
      exp: now + Math.floor(JWT_TTL_MS / 1000),
      ...claims,
    };
    const h = b64urlJson(header);
    const p = b64urlJson(payload);
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", signingKey, data));
    const token = `${h}.${p}.${b64url(sig)}`;
    sessionStorage.setItem(JWT_KEY, token);
    return token;
  }

  async function verifyJwt(token, signingKey) {
    if (!token) return { ok: false, reason: "missing" };
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "format" };
    const [h, p, s] = parts;
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = fromB64url(s);
    const ok = await crypto.subtle.verify("HMAC", signingKey, sig, data);
    if (!ok) return { ok: false, reason: "sig" };
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    } catch {
      return { ok: false, reason: "payload" };
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) return { ok: false, reason: "expired", payload };
    return { ok: true, payload };
  }

  function currentJwt() {
    return sessionStorage.getItem(JWT_KEY) || "";
  }

  function clearJwt() {
    sessionStorage.removeItem(JWT_KEY);
  }

  async function enablePassword(passphrase) {
    if (!passphrase || passphrase.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aes = await deriveAesKey(passphrase, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const check = new TextEncoder().encode(JSON.stringify({ v: 1, ok: true, at: Date.now() }));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, check));
    // Data stays usable until explicit lock() seals it.
    writeMeta({
      requireAuth: true,
      hasPassword: true,
      salt: b64url(salt),
      checkIv: b64url(iv),
      checkCt: b64url(ct),
      enabledAt: Date.now(),
    });
    const hmac = await deriveSignKey(passphrase, salt);
    await mintJwt({ sub: "local", amr: ["pwd"] }, hmac);
    window.__ascendosAuthPass = passphrase;
    // Align vault passphrase if security available
    if (typeof AscendSecurity !== "undefined") {
      try {
        const st = AscendSecurity.status();
        if (!st.hasVault || st.mode !== "passphrase") {
          await AscendSecurity.enablePassphrase(passphrase);
        }
      } catch {
        /* vault optional */
      }
    }
    return { ok: true };
  }

  async function loginPassword(passphrase) {
    const meta = readMeta();
    if (!meta.hasPassword || !meta.salt) throw new Error("Aucun mot de passe local configuré");
    const salt = fromB64url(meta.salt);
    const aes = await deriveAesKey(passphrase, salt);
    try {
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64url(meta.checkIv) },
        aes,
        fromB64url(meta.checkCt)
      );
    } catch {
      throw new Error("Mot de passe incorrect");
    }
    // Unseal data
    const sealedRaw = localStorage.getItem(SEAL_KEY);
    if (sealedRaw && !localStorage.getItem(STORE_KEY)) {
      const sealed = JSON.parse(sealedRaw);
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64url(sealed.iv) },
        aes,
        fromB64url(sealed.ct)
      );
      localStorage.setItem(STORE_KEY, new TextDecoder().decode(pt));
    }
    const hmac = await deriveSignKey(passphrase, salt);
    const token = await mintJwt({ sub: "local", amr: ["pwd"] }, hmac);
    sessionStorage.setItem("ascendos.auth.hmacSalt", meta.salt);
    // cache passphrase mark only in memory via custom event — never LS
    window.__ascendosAuthPass = passphrase;
    if (typeof AscendSecurity !== "undefined") {
      try {
        await AscendSecurity.unlockPassphrase(passphrase);
      } catch {
        /* */
      }
    }
    return { ok: true, token };
  }

  async function loginOAuth({ provider, sub, email, name }) {
    const meta = readMeta();
    if (!meta.requireAuth) {
      writeMeta({ requireAuth: true, oauthOk: true });
    }
    // OAuth session JWT signed with device key material
    const salt = meta.salt ? fromB64url(meta.salt) : crypto.getRandomValues(new Uint8Array(16));
    if (!meta.salt) writeMeta({ salt: b64url(salt), oauthOk: true });
    const material = `oauth:${provider}:${sub || email || name || "user"}`;
    const hmac = await deriveSignKey(material + (meta.checkCt || "oauth"), salt);
    const token = await mintJwt(
      {
        sub: sub || email || "oauth",
        amr: ["oauth"],
        provider,
        email: email || "",
        name: name || "",
      },
      hmac
    );
    if (typeof AscendSession !== "undefined") {
      AscendSession.save({
        provider,
        sub: sub || "",
        email: email || "",
        name: name || "",
      });
    }
    return { ok: true, token };
  }

  async function sessionValid() {
    if (!isEnabled()) return { ok: true, bypass: true };
    const token = currentJwt();
    if (!token) return { ok: false, reason: "no_token" };
    const meta = readMeta();
    // Try password-derived verify if we have cached pass
    if (window.__ascendosAuthPass && meta.salt) {
      try {
        const hmac = await deriveSignKey(window.__ascendosAuthPass, fromB64url(meta.salt));
        return verifyJwt(token, hmac);
      } catch {
        /* fallthrough */
      }
    }
    // Decode without verify for expiry UX — still require re-login if no key
    try {
      const payload = JSON.parse(new TextDecoder().decode(fromB64url(token.split(".")[1])));
      if (payload.exp * 1000 < Date.now()) return { ok: false, reason: "expired" };
      if (payload.amr?.includes("oauth") && typeof AscendSession !== "undefined" && AscendSession.isSignedIn()) {
        return { ok: true, payload, soft: true };
      }
      if (payload.amr?.includes("pwd") && sessionStorage.getItem(JWT_KEY)) {
        // Soft accept same-tab JWT until refresh without pass — re-auth on new load without __pass
        if (window.__ascendosAuthPass) return { ok: true, payload };
        return { ok: false, reason: "reauth" };
      }
    } catch {
      return { ok: false, reason: "bad_token" };
    }
    return { ok: false, reason: "reauth" };
  }

  async function lock({ reseal = true } = {}) {
    const pass = window.__ascendosAuthPass;
    const meta = readMeta();
    if (reseal && pass && meta.salt && localStorage.getItem(STORE_KEY)) {
      try {
        const aes = await deriveAesKey(pass, fromB64url(meta.salt));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const raw = localStorage.getItem(STORE_KEY);
        const sealed = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(raw))
        );
        localStorage.setItem(SEAL_KEY, JSON.stringify({ iv: b64url(iv), ct: b64url(sealed) }));
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* keep plaintext if seal fails */
      }
    }
    clearJwt();
    window.__ascendosAuthPass = null;
    if (typeof AscendSecurity !== "undefined") {
      try {
        AscendSecurity.lock();
      } catch {
        /* */
      }
    }
  }

  function disableAuth(passphrase) {
    // caller must be unlocked
    writeMeta({ requireAuth: false });
    return { ok: true };
  }

  function status() {
    const meta = readMeta();
    return {
      requireAuth: Boolean(meta.requireAuth),
      hasPassword: Boolean(meta.hasPassword),
      hasJwt: Boolean(currentJwt()),
      sealed: Boolean(localStorage.getItem(SEAL_KEY)) && !localStorage.getItem(STORE_KEY),
    };
  }

  return {
    isEnabled,
    enablePassword,
    loginPassword,
    loginOAuth,
    sessionValid,
    lock,
    disableAuth,
    status,
    currentJwt,
    clearJwt,
    JWT_TTL_MS,
  };
})();

window.AscendAuth = AscendAuth;
