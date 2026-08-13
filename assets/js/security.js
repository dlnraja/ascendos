/**
 * AscendOS Security — local vault for API keys & OAuth tokens.
 * Web Crypto: AES-GCM + PBKDF2. Secrets never written plaintext to localStorage.
 */
const AscendSecurity = (() => {
  const VAULT_LS = "ascendos.vault.v1";
  const OAUTH_LS = "ascendos.oauth.sealed";
  const OAUTH_STATE_LS = "ascendos.oauth.state";
  const META_LS = "ascendos.security.meta";
  const IDB_NAME = "ascendos-security";
  const IDB_STORE = "keys";
  const PBKDF2_ITERS = 310_000;
  const AUTO_LOCK_MS = 15 * 60 * 1000;

  const SECRET_FIELDS = [
    "gmailClientId",
    "linkedinClientId",
    "hunterApiKey",
    "underIaApiKey",
    "adzunaAppId",
    "adzunaAppKey",
    "aggregateApiBase",
  ];

  /** @type {CryptoKey | null} */
  let vaultKey = null;
  /** @type {Record<string, string>} */
  let secretsMem = {};
  /** @type {string | null} */
  let oauthTokenMem = null;
  let lastActivity = Date.now();
  let autoLockTimer = null;
  let mode = "none"; // none | device | passphrase

  function touch() {
    lastActivity = Date.now();
  }

  function hasAnySecret(obj = {}) {
    return SECRET_FIELDS.some((k) => Boolean(obj[k]));
  }

  function extractSecrets(connectors = {}) {
    const out = {};
    for (const k of SECRET_FIELDS) {
      if (connectors[k]) out[k] = String(connectors[k]);
    }
    return out;
  }

  function stripSecrets(connectors = {}) {
    const out = { ...connectors };
    for (const k of SECRET_FIELDS) out[k] = "";
    return out;
  }

  function mergeSecretsInto(connectors = {}, secrets = secretsMem) {
    const out = { ...connectors };
    for (const k of SECRET_FIELDS) {
      if (secrets[k] != null) out[k] = secrets[k];
    }
    return out;
  }

  function stripStateSecrets(state) {
    const clone = structuredClone
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
    if (clone.connectors) clone.connectors = stripSecrets(clone.connectors);
    return clone;
  }

  function redactState(state) {
    const clone = stripStateSecrets(state);
    if (clone.connectors) {
      clone.connectors._redacted = true;
      clone.connectors.gmailConnected = false;
      clone.connectors.linkedinConnected = false;
    }
    return clone;
  }

  function maskSecret(value) {
    const s = String(value || "");
    if (!s) return "";
    if (s.length <= 4) return "••••";
    return `••••${s.slice(-4)}`;
  }

  function bytesToB64(bytes) {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  async function deriveKeyFromPassphrase(passphrase, salt) {
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function aesEncrypt(key, plaintextObj) {
    const iv = randomBytes(12);
    const pt = new TextEncoder().encode(JSON.stringify(plaintextObj));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
    return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
  }

  async function aesDecrypt(key, { iv, ct }) {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(iv) },
      key,
      b64ToBytes(ct)
    );
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbDel(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getOrCreateDeviceKey() {
    let key = await idbGet("deviceKey");
    if (key) return key;
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await idbSet("deviceKey", key);
    return key;
  }

  function readVaultBlob() {
    try {
      const raw = localStorage.getItem(VAULT_LS);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeVaultBlob(blob) {
    localStorage.setItem(VAULT_LS, JSON.stringify(blob));
  }

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_LS) || "{}");
    } catch {
      return {};
    }
  }

  function writeMeta(patch) {
    const next = { ...readMeta(), ...patch, updatedAt: Date.now() };
    localStorage.setItem(META_LS, JSON.stringify(next));
    return next;
  }

  function isUnlocked() {
    return Boolean(vaultKey);
  }

  function getMode() {
    return mode;
  }

  function vaultExists() {
    return Boolean(readVaultBlob());
  }

  async function sealWithCurrentKey(payload) {
    if (!vaultKey) throw new Error("Coffre verrouillé");
    const sealed = await aesEncrypt(vaultKey, payload);
    const blob = {
      v: 1,
      mode,
      algo: "AES-GCM",
      kdf: mode === "passphrase" ? "PBKDF2-SHA256" : "device",
      iterations: mode === "passphrase" ? PBKDF2_ITERS : undefined,
      salt: mode === "passphrase" ? readVaultBlob()?.salt : undefined,
      ...sealed,
      at: Date.now(),
    };
    writeVaultBlob(blob);
    writeMeta({ mode, hasVault: true });
    return blob;
  }

  async function persistSecretsFrom(connectors) {
    touch();
    const secrets = extractSecrets(connectors);
    const blob = readVaultBlob();
    if (!vaultKey) {
      // Never overwrite a passphrase vault while locked
      if (blob?.mode === "passphrase") return;
      if (!hasAnySecret(secrets) && !blob) return;
      vaultKey = await getOrCreateDeviceKey();
      mode = "device";
    }
    secretsMem = { ...secrets };
    await sealWithCurrentKey({ secrets: secretsMem });
  }

  async function unlockDevice() {
    const blob = readVaultBlob();
    if (!blob) {
      vaultKey = await getOrCreateDeviceKey();
      mode = "device";
      secretsMem = {};
      return { ok: true, mode };
    }
    if (blob.mode === "passphrase") {
      mode = "passphrase";
      return { ok: false, needPassphrase: true };
    }
    vaultKey = await getOrCreateDeviceKey();
    mode = "device";
    try {
      const data = await aesDecrypt(vaultKey, blob);
      secretsMem = data.secrets || {};
      return { ok: true, mode };
    } catch {
      return { ok: false, error: "device_decrypt_failed" };
    }
  }

  async function unlockPassphrase(passphrase) {
    const blob = readVaultBlob();
    if (!blob || blob.mode !== "passphrase") {
      throw new Error("Pas de coffre passphrase");
    }
    const salt = b64ToBytes(blob.salt);
    vaultKey = await deriveKeyFromPassphrase(passphrase, salt);
    mode = "passphrase";
    const data = await aesDecrypt(vaultKey, blob);
    secretsMem = data.secrets || {};
    writeMeta({ mode: "passphrase", unlockedAt: Date.now() });
    startAutoLock();
    touch();
    return true;
  }

  async function enablePassphrase(passphrase) {
    if (!passphrase || passphrase.length < 8) {
      throw new Error("Passphrase ≥ 8 caractères");
    }
    const salt = randomBytes(16);
    const key = await deriveKeyFromPassphrase(passphrase, salt);
    vaultKey = key;
    mode = "passphrase";
    const sealed = await aesEncrypt(key, { secrets: secretsMem });
    writeVaultBlob({
      v: 1,
      mode: "passphrase",
      algo: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERS,
      salt: bytesToB64(salt),
      ...sealed,
      at: Date.now(),
    });
    writeMeta({ mode: "passphrase", hasVault: true });
    // Drop device-only key material path for secrets (IDB key can remain for other uses)
    startAutoLock();
    touch();
  }

  async function changePassphrase(oldPass, newPass) {
    await unlockPassphrase(oldPass);
    await enablePassphrase(newPass);
  }

  function lock() {
    vaultKey = null;
    secretsMem = {};
    oauthTokenMem = null;
    try {
      sessionStorage.removeItem(OAUTH_LS);
    } catch {
      /* ignore */
    }
    if (autoLockTimer) clearInterval(autoLockTimer);
    autoLockTimer = null;
    writeMeta({ lockedAt: Date.now() });
  }

  function startAutoLock() {
    if (autoLockTimer) clearInterval(autoLockTimer);
    autoLockTimer = setInterval(() => {
      if (!vaultKey) return;
      if (Date.now() - lastActivity > AUTO_LOCK_MS) {
        lock();
        window.dispatchEvent(new CustomEvent("ascendos:vault-lock"));
      }
    }, 30_000);
  }

  async function wipeSecrets() {
    secretsMem = {};
    oauthTokenMem = null;
    vaultKey = null;
    localStorage.removeItem(VAULT_LS);
    try {
      sessionStorage.removeItem(OAUTH_LS);
      sessionStorage.removeItem(OAUTH_STATE_LS);
      sessionStorage.removeItem("ascendos.oauth");
    } catch {
      /* ignore */
    }
    try {
      await idbDel("deviceKey");
    } catch {
      /* ignore */
    }
    writeMeta({ wipedAt: Date.now(), hasVault: false, mode: "none" });
    mode = "none";
  }

  /** Migrate plaintext connector secrets from legacy state into vault. */
  async function migrateFromState(state) {
    const plain = extractSecrets(state.connectors || {});
    if (!hasAnySecret(plain)) return { migrated: false };
    if (!vaultKey) {
      vaultKey = await getOrCreateDeviceKey();
      mode = "device";
    }
    secretsMem = { ...secretsMem, ...plain };
    await sealWithCurrentKey({ secrets: secretsMem });
    state.connectors = stripSecrets(state.connectors);
    return { migrated: true };
  }

  async function init(state) {
    touch();
    const blob = readVaultBlob();
    if (blob?.mode === "passphrase") {
      mode = "passphrase";
      // keep locked until user unlocks
      state.connectors = stripSecrets(state.connectors);
      const legacy = extractSecrets(
        JSON.parse(localStorage.getItem("ascendos.v1") || "{}").connectors || {}
      );
      // If legacy still has plaintext, hold in mem only after unlock — strip LS now
      if (hasAnySecret(legacy)) {
        // strip immediately from LS via caller persist
      }
      startActivityListeners();
      return { locked: true, mode: "passphrase" };
    }

    const unlocked = await unlockDevice();
    if (unlocked.ok) {
      const mig = await migrateFromState(state);
      state.connectors = mergeSecretsInto(stripSecrets(state.connectors), secretsMem);
      startAutoLock();
      startActivityListeners();
      return { locked: false, mode, migrated: mig.migrated };
    }
    if (unlocked.needPassphrase) {
      state.connectors = stripSecrets(state.connectors);
      startActivityListeners();
      return { locked: true, mode: "passphrase" };
    }
    // fresh
    const mig = await migrateFromState(state);
    state.connectors = mergeSecretsInto(stripSecrets(state.connectors), secretsMem);
    startActivityListeners();
    return { locked: false, mode, migrated: mig.migrated };
  }

  function startActivityListeners() {
    ["pointerdown", "keydown", "visibilitychange"].forEach((ev) => {
      window.addEventListener(ev, () => touch(), { passive: true });
    });
  }

  function getSecrets() {
    return { ...secretsMem };
  }

  function applySecretsToState(state) {
    if (!state.connectors) state.connectors = {};
    state.connectors = mergeSecretsInto(state.connectors, secretsMem);
    return state;
  }

  function clearSecretsFromState(state) {
    if (!state.connectors) return state;
    state.connectors = stripSecrets(state.connectors);
    return state;
  }

  // —— OAuth token hygiene ——
  function createOAuthState(provider) {
    const nonce = bytesToB64(randomBytes(24));
    const record = { nonce, provider, at: Date.now() };
    sessionStorage.setItem(OAUTH_STATE_LS, JSON.stringify(record));
    return nonce;
  }

  function consumeOAuthState(nonce) {
    try {
      const raw = sessionStorage.getItem(OAUTH_STATE_LS);
      sessionStorage.removeItem(OAUTH_STATE_LS);
      if (!raw) return false;
      const rec = JSON.parse(raw);
      if (rec.nonce !== nonce) return false;
      if (Date.now() - rec.at > 15 * 60 * 1000) return false;
      return true;
    } catch {
      return false;
    }
  }

  async function storeOAuthToken(tokenPayload) {
    oauthTokenMem = tokenPayload.access_token || null;
    // Remove legacy plaintext
    try {
      sessionStorage.removeItem("ascendos.oauth");
    } catch {
      /* ignore */
    }
    if (!vaultKey || !oauthTokenMem) {
      // memory-only for this tab
      sessionStorage.setItem(
        OAUTH_LS,
        JSON.stringify({ memOnly: true, expires_in: tokenPayload.expires_in, at: Date.now() })
      );
      return;
    }
    const sealed = await aesEncrypt(vaultKey, {
      access_token: tokenPayload.access_token,
      expires_in: tokenPayload.expires_in,
      token_type: tokenPayload.token_type,
      scope: tokenPayload.scope,
      at: Date.now(),
    });
    sessionStorage.setItem(OAUTH_LS, JSON.stringify({ sealed: true, ...sealed }));
  }

  async function getOAuthToken() {
    if (oauthTokenMem) return oauthTokenMem;
    try {
      const raw = sessionStorage.getItem(OAUTH_LS);
      if (!raw) {
        // legacy plaintext migration → wipe
        const legacy = sessionStorage.getItem("ascendos.oauth");
        if (legacy) {
          sessionStorage.removeItem("ascendos.oauth");
          try {
            const data = JSON.parse(legacy);
            oauthTokenMem = data.access_token || null;
            return oauthTokenMem;
          } catch {
            return null;
          }
        }
        return null;
      }
      const data = JSON.parse(raw);
      if (data.memOnly) return oauthTokenMem;
      if (data.sealed && vaultKey) {
        const tok = await aesDecrypt(vaultKey, data);
        const expMs = Number(tok.expires_in || 3600) * 1000;
        if (Date.now() - tok.at > expMs - 30_000) {
          clearOAuthToken();
          return null;
        }
        oauthTokenMem = tok.access_token;
        return oauthTokenMem;
      }
    } catch {
      return null;
    }
    return null;
  }

  function clearOAuthToken() {
    oauthTokenMem = null;
    try {
      sessionStorage.removeItem(OAUTH_LS);
      sessionStorage.removeItem("ascendos.oauth");
    } catch {
      /* ignore */
    }
  }

  /** Encrypt magic-link payload (requires passphrase mode + unlocked). */
  async function sealMagicPayload(connectors) {
    if (mode !== "passphrase" || !vaultKey) {
      throw new Error("Active une passphrase pour un magic link chiffré");
    }
    const secrets = extractSecrets(connectors);
    const sealed = await aesEncrypt(vaultKey, { secrets, v: 2 });
    const blob = readVaultBlob();
    return {
      v: 2,
      enc: true,
      salt: blob.salt,
      iterations: PBKDF2_ITERS,
      ...sealed,
    };
  }

  async function openMagicPayload(payload, passphrase) {
    if (!payload) throw new Error("Payload vide");
    if (payload.enc || payload.v === 2) {
      if (!passphrase) throw new Error("Passphrase requise pour ce magic link");
      const salt = b64ToBytes(payload.salt);
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const data = await aesDecrypt(key, payload);
      return data.secrets || data;
    }
    // legacy plaintext compact — still accepted once, then should be re-sealed
    const mapped = {};
    if (payload.g) mapped.gmailClientId = payload.g;
    if (payload.l) mapped.linkedinClientId = payload.l;
    if (payload.h) mapped.hunterApiKey = payload.h;
    if (payload.u) mapped.underIaApiKey = payload.u;
    if (payload.ub) mapped.underIaApiBase = payload.ub;
    if (payload.a) mapped.adzunaAppId = payload.a;
    if (payload.k) mapped.adzunaAppKey = payload.k;
    if (payload.b) mapped.aggregateApiBase = payload.b;
    for (const k of SECRET_FIELDS) {
      if (payload[k]) mapped[k] = payload[k];
    }
    return mapped;
  }

  function status() {
    return {
      unlocked: isUnlocked(),
      mode,
      hasVault: vaultExists(),
      secretCount: SECRET_FIELDS.filter((k) => Boolean(secretsMem[k])).length,
      autoLockMinutes: AUTO_LOCK_MS / 60000,
    };
  }

  return {
    SECRET_FIELDS,
    touch,
    hasAnySecret,
    extractSecrets,
    stripSecrets,
    mergeSecretsInto,
    stripStateSecrets,
    redactState,
    maskSecret,
    init,
    persistSecretsFrom,
    unlockDevice,
    unlockPassphrase,
    enablePassphrase,
    changePassphrase,
    lock,
    wipeSecrets,
    migrateFromState,
    isUnlocked,
    getMode,
    vaultExists,
    getSecrets,
    applySecretsToState,
    clearSecretsFromState,
    createOAuthState,
    consumeOAuthState,
    storeOAuthToken,
    getOAuthToken,
    clearOAuthToken,
    sealMagicPayload,
    openMagicPayload,
    status,
  };
})();

window.AscendSecurity = AscendSecurity;
