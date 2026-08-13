# Optional OAuth / Gmail proxy

GitHub Pages is static. For production Gmail send + LinkedIn code exchange:

1. Deploy a Cloudflare Worker (or Cloud Function).
2. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
3. Endpoints:
   - `POST /oauth/google/exchange` — auth code → tokens
   - `POST /gmail/draft` — create draft with user access token
   - `POST /oauth/linkedin/exchange`
4. Never store CV bodies in logs.

Keep AscendOS UI pointed at your worker origin via a setting (future `connectors.apiBase`).
