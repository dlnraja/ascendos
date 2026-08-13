# Optional backends (free tiers)

| Target | Path | GitHub Action |
|--------|------|---------------|
| Cloudflare Worker | `workers/aggregate.js` + `wrangler.toml` | `deploy-cloudflare.yml` |
| Cloudflare Pages | static root | `deploy-cloudflare-pages.yml` |
| Vercel | `api/aggregate.js` + `vercel.json` | `deploy-vercel.yml` |
| Oracle Always Free | `server/oracle-aggregate.mjs` | `deploy-oracle.yml` |
| GitHub Pages | static | `pages.yml` |

Secrets & steps: [docs/FREE_HOSTING.md](../docs/FREE_HOSTING.md).

Checklist: Actions → **Free deploy matrix**.
