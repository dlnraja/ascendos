# Free hosting stack — when GitHub Pages is not enough

AscendOS stays **static-first** on GitHub Pages. When you need a **server-side aggregator** (CORS, RSS XML, rate limits), add a free backend.

## Matrix (authorized free / freemium)

| Plateforme | Gratuit ? | Rôle AscendOS | Limites typiques |
|------------|-----------|---------------|------------------|
| **GitHub Pages** | Oui | Front `index.html` / `app.html` | Statique seul, pas de Node |
| **Cloudflare Workers** | Oui (free tier) | `/aggregate` API | 100k req/jour ordre de grandeur |
| **Cloudflare Pages** | Oui | Front + binding Worker | Comme Pages + Workers |
| **Vercel** | Oui (Hobby) | Front + `/api/aggregate` | Fonctions limitées (durée/CPU) |
| **Netlify** | Oui | Front + Functions (même idée) | Quotas free |
| **Oracle Cloud Always Free** | Oui* | VM ARM / Ampere pour front + Node | *Compte vérifié ; respect ToS Oracle |
| **Fly.io / Render** | Freemium | Petit container Node | Sleep / quotas |

\* Oracle Always Free est **autorisé** pour usage perso/projets dans les limites Always Free (ARM OCPU/RAM, Object Storage, etc.). Pas de carte bancaire abus — suis leur policy actuelle.

## Architecture recommandée (0 €)

```
Navigateur AscendOS  →  GitHub Pages (UI)
                     ↘  Cloudflare Worker ou Vercel /api/aggregate  →  Remotive, RemoteOK, RSS…
```

Dans l’app : **Connecteurs → URL API agrégateur** = `https://<ton-worker>.workers.dev` ou `https://<projet>.vercel.app`.

## 1) Cloudflare Worker (recommandé)

```bash
npm i -D wrangler
npx wrangler login
npx wrangler deploy
```

Endpoints :
- `GET /health`
- `GET /aggregate?q=engineer&hours=24&sources=remotive,remoteok,arbeitnow`
- `POST /aggregate` `{ "query", "hours", "sources", "rss": [] }`

Free tier : rate-limit soft ~30 req/h/IP dans le worker.

## 2) Vercel Hobby

```bash
npm i -g vercel
vercel
```

API : `https://<projet>.vercel.app/api/aggregate`

Le front peut aussi être servi par Vercel (`vercel.json` fourni). Tu peux garder le front sur GitHub Pages et n’utiliser Vercel que pour l’API.

## 3) Oracle Cloud Always Free (optionnel)

1. Crée un compte Oracle Cloud (Always Free eligible).
2. Lance une VM **Ampere A1** Always Free (Ubuntu).
3. Installe Node 20 + Caddy (HTTPS).
4. Clone ce repo, sers les fichiers statiques, et lance un petit serveur :

```bash
# Sur la VM
node server/oracle-aggregate.mjs
# reverse-proxy Caddy : /api/aggregate → localhost:8787
```

Respecte les [Always Free limits](https://www.oracle.com/cloud/free/) et conditions d’usage.

## 4) Netlify (alternative)

Même schéma que Vercel : Functions sous `netlify/functions/aggregate.js` (tu peux adapter `api/aggregate.js`).

## Sécurité / ToS

- Clés Adzuna uniquement en variables d’env côté Worker/Vercel si tu les migres (aujourd’hui localStorage côté client).
- Pas de scrape LinkedIn/X.
- Crédite Remotive / RemoteOK / etc. (liens originaux déjà dans les jobs).

## Config dans AscendOS

**Connecteurs** → champ `URL API agrégateur`  
Exemple : `https://ascendos-aggregate.<toi>.workers.dev`

Le Radar frais appellera alors `POST {apiBase}/aggregate` au lieu du fetch navigateur pur.
