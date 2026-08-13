# Free hosting stack — GitHub Actions → Pages / Cloudflare / Vercel / Oracle

AscendOS reste **static-first**. Les backends optionnels ne stockent **aucune** donnée utilisateur (PII interdite).

## Matrice gratuite

| Plateforme | Gratuit | Rôle | Workflow Actions |
|------------|---------|------|------------------|
| **GitHub Pages** | Oui | Front | `.github/workflows/pages.yml` |
| **Cloudflare Workers** | Oui (free) | API `/aggregate` | `deploy-cloudflare.yml` |
| **Cloudflare Pages** | Oui | Front | `deploy-cloudflare-pages.yml` |
| **Vercel Hobby** | Oui | Front + `/api/aggregate` | `deploy-vercel.yml` |
| **Oracle Always Free** | Oui* | VM + Node aggregate | `deploy-oracle.yml` |
| Checklist | — | Voir secrets manquants | `free-deploy-matrix.yml` |

\* Compte Oracle vérifié, quotas Always Free, ToS Oracle.

**Avertissement :** backends free = pour l’agrégation d’APIs/RSS **autorisées** uniquement.
Pas de scrape / bypass. Responsabilité utilisateur : [`DISCLAIMER.md`](DISCLAIMER.md).

```
Navigateur  →  GitHub Pages ou CF Pages ou Vercel (UI)
            ↘  Worker CF / Vercel /api / Oracle :8787  →  APIs/RSS offres
```

Dans AscendOS : **Connecteurs → URL API agrégateur**.

---

## Secrets GitHub (Settings → Secrets and variables → Actions)

### Cloudflare
| Secret | Où |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Dashboard CF → My Profile → API Tokens (Edit Workers + Pages) |
| `CLOUDFLARE_ACCOUNT_ID` | Sidebar droite du dashboard |
| `CF_PAGES_PROJECT` | Optionnel (défaut `ascendos`) |

Puis : **Actions → Deploy Cloudflare Worker → Run workflow**.

### Vercel
1. Une fois en local : `npx vercel login` puis `npx vercel link`
2. Crée un token : Vercel → Settings → Tokens
3. Secrets :
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` (dans `.vercel/project.json` → `orgId`)
   - `VERCEL_PROJECT_ID` (idem → `projectId`)

Puis : **Actions → Deploy Vercel → Run workflow**.

### Oracle Always Free
1. VM Ampere A1, Ubuntu, Node 20, clé SSH
2. Secrets : `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY` (clé privée complète)
3. Optionnel : `ORACLE_PATH` (défaut `~/ascendos`)
4. Sur la VM, ouvre le port / reverse-proxy (Caddy) vers `8787`

Puis : **Actions → Deploy Oracle Always Free → Run workflow**.

### GitHub Pages
**Settings → Pages → Source : GitHub Actions** (pas de secret). Push sur `main` suffit.

---

## Déploiements manuels (sans Actions)

```bash
# Cloudflare Worker
npm i
npx wrangler login
npx wrangler deploy

# Vercel
npx vercel --prod

# Oracle (sur la VM)
node server/oracle-aggregate.mjs
```

## Sécurité / ToS

- Pas de scrape LinkedIn/X / contournement anti-bot
- Pas de PII dans `/aggregate`
- Clés Adzuna éventuelles = variables d’env côté backend, jamais commit

## Config app

**Connecteurs** → `URL API agrégateur`  
Ex. `https://ascendos-aggregate.<toi>.workers.dev` ou `https://<projet>.vercel.app`
