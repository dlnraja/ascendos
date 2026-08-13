# Free hosting stack — GitHub Actions → Pages / Cloudflare / Vercel / Oracle

AscendOS reste **static-first** + façade **AscendCore** (local → upgrade → cooldown). Les backends optionnels ne stockent **aucune** donnée utilisateur (PII interdite).

## Matrice gratuite

| Plateforme | Gratuit | Rôle | Workflow Actions | Statut typique |
|------------|---------|------|------------------|----------------|
| **GitHub Pages** | Oui | Front | `.github/workflows/pages.yml` | Auto sur push `master` |
| **Cloudflare Workers** | Oui (free) | API `/aggregate` | `deploy-cloudflare.yml` | Secrets CF requis |
| **Cloudflare Pages** | Oui | Front | `deploy-cloudflare-pages.yml` | Secrets CF requis |
| **Vercel Hobby** | Oui | Front + `/api/aggregate` | `deploy-vercel.yml` | Secrets Vercel requis |
| **Oracle Always Free** | Oui* | VM + Node aggregate | `deploy-oracle.yml` | Secrets SSH requis |
| Checklist | — | Voir secrets manquants | `free-deploy-matrix.yml` | `workflow_dispatch` |

\* Compte Oracle vérifié, quotas Always Free, ToS Oracle.

**Avertissement :** backends free = pour l’agrégation d’APIs/RSS **autorisées** uniquement.
Pas de scrape / bypass. Responsabilité utilisateur : [`DISCLAIMER.md`](DISCLAIMER.md).

```
Navigateur  →  GitHub Pages ou CF Pages ou Vercel (UI)
            ↘  Worker CF / Vercel /api / Oracle :8787  →  APIs/RSS offres
```

Dans AscendOS : **Connecteurs → URL API agrégateur** (upgrade AscendCore ; sans URL = radar 100 % navigateur).

---

## Secrets GitHub (Settings → Secrets and variables → Actions)

### Cloudflare
| Secret | Où |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Dashboard CF → My Profile → API Tokens (Edit Workers + Pages) |
| `CLOUDFLARE_ACCOUNT_ID` | Sidebar droite du dashboard |
| `CF_PAGES_PROJECT` | Optionnel (défaut `ascendos`) |

Puis : **Actions → Deploy Cloudflare Worker → Run workflow**.

### Vercel (Hobby)
1. Une fois en local : `npx vercel login` puis `npx vercel link` (à la racine du repo)
2. Crée un token : [Vercel → Settings → Tokens](https://vercel.com/account/tokens)
3. Secrets GitHub :
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` (dans `.vercel/project.json` → `orgId`)
   - `VERCEL_PROJECT_ID` (idem → `projectId`)
4. **Actions → Deploy Vercel → Run workflow** (ou push sur `master`)

Sans ces 3 secrets, le workflow **réussit en skip** (notice dans le résumé) — le front reste sur GitHub Pages.

URL utile après deploy : `https://<projet>.vercel.app` (UI) et agrégateur à coller dans Connecteurs : `https://<projet>.vercel.app` (le client appelle `/aggregate` via la base).

### Oracle Always Free
1. VM Ampere A1, Ubuntu, Node 20, clé SSH
2. Secrets : `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY` (clé privée complète)
3. Optionnel : `ORACLE_PATH` (défaut `~/ascendos`)
4. Sur la VM, ouvre le port / reverse-proxy (Caddy) vers `8787`

Puis : **Actions → Deploy Oracle Always Free → Run workflow**.

### GitHub Pages
**Settings → Pages → Source : GitHub Actions** (pas de secret). Push sur `main`/`master` suffit.  
Site : `https://dlnraja.github.io/ascendos/`

---

## Déploiements manuels (sans Actions)

```bash
# Cloudflare Worker
npm i
npx wrangler login
npx wrangler deploy

# Vercel
npx vercel login
npx vercel link
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
Sans URL : AscendCore reste en **local** (Remotive / RemoteOK / RSS dans le navigateur).
