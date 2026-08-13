/**
 * GmailSend — send mail via the USER's Gmail (OAuth token in browser).
 * Never goes through an AscendOS server. Falls back to mailto / compose if no token.
 */
const GmailSend = (() => {
  const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

  function utf8ToBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function encodeHeader(value) {
    const s = String(value || "");
    if (/^[\x20-\x7E]*$/.test(s)) return s;
    return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
  }

  function buildRawMessage({ to, subject, body, from, cc, replyTo }) {
    const lines = [
      `To: ${to}`,
      from ? `From: ${from}` : null,
      cc ? `Cc: ${cc}` : null,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      String(body || "").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
    ].filter((l) => l != null);
    return utf8ToBase64Url(lines.join("\r\n"));
  }

  async function getAccessToken() {
    if (typeof Connectors !== "undefined" && Connectors.getStoredToken) {
      return Connectors.getStoredToken();
    }
    if (typeof AscendSecurity !== "undefined") {
      return AscendSecurity.getOAuthToken();
    }
    return null;
  }

  function tokenHasSendScope(tokenPayload) {
    // Implicit flow may store scope string on sealed token — check if available
    const scope = tokenPayload?.scope || "";
    if (!scope) return true; // assume OK if unknown; API will 403 otherwise
    return String(scope).includes("gmail.send") || String(scope).includes("gmail.compose") || String(scope).includes("mail.google.com");
  }

  /**
   * Send via Gmail API users.messages.send
   * @returns {{ ok: boolean, path: string, id?: string, error?: string, fallback?: object }}
   */
  async function send({ to, subject, body, from, mode = "send" } = {}) {
    const dest = String(to || "").trim();
    if (!dest || !dest.includes("@")) {
      return { ok: false, path: "none", error: "Destinataire email requis" };
    }

    const token = await getAccessToken();
    if (!token) {
      const fb =
        typeof LocalStack !== "undefined"
          ? LocalStack.openMailDraft({ to: dest, subject, body })
          : typeof Connectors !== "undefined"
            ? Connectors.mailtoDraft({ to: dest, subject, body })
            : null;
      return {
        ok: false,
        path: "fallback_mailto",
        error: "Pas de token Gmail — brouillon ouvert (mailto / Gmail web)",
        fallback: fb,
      };
    }

    try {
      if (typeof AscendQuotas !== "undefined") AscendQuotas.consume("gmail_send");
    } catch (e) {
      return { ok: false, path: "quota", error: e.message };
    }

    const raw = buildRawMessage({
      to: dest,
      subject: subject || "(sans objet)",
      body: body || "",
      from: from || undefined,
      replyTo: from || undefined,
    });

    const fetchFn = typeof AscendResilience !== "undefined" ? AscendResilience.fetch : fetch;
    const endpoint =
      mode === "draft"
        ? "https://gmail.googleapis.com/gmail/v1/users/me/drafts"
        : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    const payload =
      mode === "draft"
        ? { message: { raw } }
        : { raw };

    try {
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        const fb =
          typeof LocalStack !== "undefined"
            ? LocalStack.openMailDraft({ to: dest, subject, body })
            : null;
        return {
          ok: false,
          path: "fallback_mailto",
          error: "Token Gmail expiré ou scope send manquant — reconnecte Gmail (OAuth), brouillon ouvert",
          fallback: fb,
          http: res.status,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          path: "api_error",
          error: data?.error?.message || `Gmail HTTP ${res.status}`,
          http: res.status,
        };
      }
      return {
        ok: true,
        path: mode === "draft" ? "gmail_draft" : "gmail_send",
        id: data.id || data.message?.id || null,
        data,
      };
    } catch (e) {
      const fb =
        typeof LocalStack !== "undefined"
          ? LocalStack.openMailDraft({ to: dest, subject, body })
          : null;
      return {
        ok: false,
        path: "fallback_mailto",
        error: `Gmail down: ${e.message} — brouillon ouvert`,
        fallback: fb,
      };
    }
  }

  /** Confirm then send — human-in-the-loop. Cancel opens mailto draft. */
  async function sendWithConfirm(draft, { confirmFn } = {}) {
    const ask =
      confirmFn ||
      ((msg) => Promise.resolve(window.confirm(msg)));
    const ok = await ask(
      `Envoyer via ton Gmail à ${draft.to} ?\n\nObjet: ${draft.subject || ""}\n\nOK = envoi Gmail API\nAnnuler = ouvrir un brouillon (mailto)`
    );
    if (!ok) {
      const fb =
        typeof LocalStack !== "undefined"
          ? LocalStack.openMailDraft(draft)
          : typeof Connectors !== "undefined"
            ? Connectors.mailtoDraft(draft)
            : null;
      return { ok: false, path: "cancelled_mailto", fallback: fb };
    }
    return send({ ...draft, mode: "send" });
  }

  return {
    SEND_SCOPE,
    buildRawMessage,
    send,
    sendWithConfirm,
    getAccessToken,
  };
})();

window.GmailSend = GmailSend;
