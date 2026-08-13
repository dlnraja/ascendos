/**
 * Cloudflare Worker — AscendOS aggregate API (free tier)
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
      return json({ ok: true, service: "ascendos-cf" }, origin);
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
      } catch {
        /* ignore */
      }
    }

    const result = await aggregateServer({ query, hours, sources, rss });
    return json(result, origin);
  },
};

function json(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}
