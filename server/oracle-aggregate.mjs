/**
 * Tiny Node aggregator for Oracle Always Free / any VPS.
 * Usage: node server/oracle-aggregate.mjs
 * Env: PORT=8787
 */
import http from "node:http";
import { aggregateServer, corsHeaders } from "../shared/aggregate-core.mjs";

const PORT = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "*";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, service: "ascendos-oracle" }));
    return;
  }

  if (url.pathname !== "/aggregate") {
    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  let body = {};
  if (req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
  }

  const query = body.query || url.searchParams.get("q") || "";
  const hours = Number(body.hours || url.searchParams.get("hours") || 24);
  const sources = body.sources || String(url.searchParams.get("sources") || "").split(",").filter(Boolean);
  const rss = body.rss || String(url.searchParams.get("rss") || "").split(",").filter(Boolean);

  try {
    const result = await aggregateServer({ query, hours, sources, rss });
    res.writeHead(200, headers);
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`AscendOS aggregate on :${PORT}`);
});
