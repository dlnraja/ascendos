/**
 * Vercel Serverless Function — GET/POST /api/aggregate
 * Free hobby tier only. No user PII accepted or stored.
 */
import { aggregateServer, corsHeaders } from "../shared/aggregate-core.mjs";

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const q = req.method === "POST" ? req.body || {} : req.query || {};
    if (
      Object.keys(q).some((k) =>
        /profile|email|phone|cv|token|password|hunter|linkedin|contact/i.test(k)
      )
    ) {
      res.status(400).json({ error: "pii_forbidden", message: "No personal data accepted" });
      return;
    }
    const query = q.query || q.q || "";
    const hours = Number(q.hours || 24);
    const sources = Array.isArray(q.sources)
      ? q.sources
      : String(q.sources || "")
          .split(",")
          .filter(Boolean);
    const rss = Array.isArray(q.rss)
      ? q.rss
      : String(q.rss || "")
          .split(",")
          .filter(Boolean);

    const result = await aggregateServer(
      { query, hours, sources, rss },
      { headers: { get: (n) => req.headers[n.toLowerCase()] || req.headers[n] } }
    );
    res.status(200).json(result);
  } catch (e) {
    const code = e.code === 429 ? 429 : e.code === 400 ? 400 : 500;
    res.status(code).json({ error: String(e.message || e), freeTierOnly: true });
  }
}
