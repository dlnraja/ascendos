/**
 * Cloudflare Worker — AscendOS aggregate API (free tier only).
 * No user PII. No durable storage of requests. Soft rate-limit.
 * Deploy: npx wrangler deploy
 */
import { aggregateServer, corsHeaders } from "../shared/aggregate-core.mjs";

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json(
        { ok: true, service: "ascendos-cf", privacy: "no_user_data_stored", freeTierOnly: true },
        origin
      );
    }

    if (url.pathname !== "/aggregate" && url.pathname !== "/") {
      return json({ error: "not_found" }, origin, 404);
    }

    let query = url.searchParams.get("q") || "";
    let hours = Number(url.searchParams.get("hours") || 24);
    let sources = (url.searchParams.get("sources") || "").split(",").filter(Boolean);
    let rss = (url.searchParams.get("rss") || "").split(",").filter(Boolean);

    if (request.method === "POST") {
      try {
        const body = await request.json();
        query = body.query || query;
        hours = Number(body.hours || hours);
        sources = body.sources || sources;
        rss = body.rss || rss;
        // Reject accidental PII keys early
        const bodyKeys = Object.keys(body || {});
        if (
          bodyKeys.some((k) =>
            /profile|email|phone|cv|token|password|hunter|linkedin|contact/i.test(k)
          )
        ) {
          return json({ error: "pii_forbidden", message: "No personal data accepted" }, origin, 400);
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const result = await aggregateServer({ query, hours, sources, rss }, request);
      return json(result, origin);
    } catch (e) {
      const code = e.code === 429 ? 429 : e.code === 400 ? 400 : 500;
      return json({ error: String(e.message || e), freeTierOnly: true }, origin, code);
    }
  },
};

function json(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}
