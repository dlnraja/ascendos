# AscendOS

**Tous métiers. Meilleur job, pas juste un autre job.**

Outil carrière open-source, **local-first** : pilotage one-click, score d’upgrade, passerelles, CV honnête, match offre ↔ profil, pipeline, file d’apply et emails RH.

**Pas de serveur de comptes AscendOS, pas de base de données utilisateur — l’éditeur ne possède aucune donnée des utilisateurs (RGPD).** Tout vit dans *ton* navigateur. Quotas gratuits plafonnés. **Fonctionne sans connecteurs / clés** ([`docs/LOCAL_STACK.md`](docs/LOCAL_STACK.md)) ; session Google / LinkedIn optionnelle — [`docs/PRIVACY.md`](docs/PRIVACY.md).

### Une logique pour tous les modules

Radar, emails, Gmail, session, enrich, batch, CV / lettres : **même façade** `AscendCore` / `LocalStack` — essayer l’upgrade → soft-fail → compensation locale. Jamais bloquer CV, file, profil ou AutoFill. Détail : [`docs/LOCAL_STACK.md`](docs/LOCAL_STACK.md) · limites légales : [`docs/DISCLAIMER.md`](docs/DISCLAIMER.md).

## Pourquoi AscendOS

| Couche | Rôle |
|--------|------|
| Vecteurs | Séniorité, paie, marque, ownership, skills rares, plateforme… |
| Passerelles | Ponts entre familles de métiers (santé, vente, BTP, tech, public…) |
| Coups de levier | Intérim, ex-client, pénurie, scope jump, certif, international… |
| CV honnête | Reframing vocabulaire / preuves — **jamais** d’invention de faits |
| Match + apply | Scanner mots-clés, file priorisée, outreach RH en plus du CRM |

Docs : [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) · [`docs/LOCAL_STACK.md`](docs/LOCAL_STACK.md) · [`docs/PRIVACY.md`](docs/PRIVACY.md) · [`docs/DISCLAIMER.md`](docs/DISCLAIMER.md)

## Modules

| Module | Fonction |
|--------|----------|
| **Carte évolutions** | Dashboard interactif passerelles / vecteurs / coups de levier |
| **Fiche offre** | Hub : levier, ATS, package, readiness, lettre, prépa entretien |
| **One-Click** | Workflows : sprint, PRIME, pack candidature, boost, prépa entretien |
| **Radar frais** | Offres récentes (&lt;1h / &lt;24h) classées par levier carrière |
| **ATS Match** | Score profil ↔ offre, gaps mots-clés |
| **Pipeline** | Suivi Saved → Offer avec score d’upgrade |
| **CV Studio** | Versions ciblées + lettres générées localement |
| **LinkedIn Boost** | Headline / about / positionnement |
| **Profil** | Vecteurs d’upgrade + **modes lieu/remote/hybride** (cases décochables) + zones |
| **CV / lettres** | Génération honnête par offre, correction NL, PDF, mémoire retours |
| **Login local** | Mot de passe + JWT appareil + OAuth Google / LinkedIn (zéro compte AscendOS) |
| **Apply Queue** | File priorisée + score Ready + **Batch / Loop Apply** |
| **AutoFill** | Bookmarklet portails RH + gaps interactifs + enrichissement public / Workspace |
| **Email Finder** | Permutator local (0 clé) + cartes/vCard/signatures + MX + export · Hunter/Under IA optionnels |
| **Rythme hebdo** | Streak + objectifs locaux (candidatures / outreach / prépa) |
| **Session + connecteurs** | Identité optionnelle, magic links, coffre chiffré — zéro cloud AscendOS |

## Démarrage local

```bash
npx --yes serve .
```

Ouvre `http://localhost:3000` (ou `index.html` / `app.html` directement).

## Déploiement (live)

| Cible | URL |
|-------|-----|
| **GitHub Pages** | https://dlnraja.github.io/ascendos/ · [app](https://dlnraja.github.io/ascendos/app.html) |
| **Vercel Hobby** | https://ascendos-nine.vercel.app/ · [app](https://ascendos-nine.vercel.app/app) |
| Agrégateur (optionnel) | coller `https://ascendos-nine.vercel.app` dans Connecteurs → URL API agrégateur |

Sans URL agrégateur, le radar tourne **en local** (AscendCore). Worker Cloudflare / Oracle : secrets encore à ajouter — [`docs/FREE_HOSTING.md`](docs/FREE_HOSTING.md).

## Déploiement GitHub Pages (fork)

1. Pousse le repo sur GitHub.
2. **Settings → Pages → Source : GitHub Actions** (workflow `.github/workflows/pages.yml`).
3. Site : `https://<user>.github.io/ascendos/` · app : `…/app.html`.

Backends free-tier **optionnels** (CORS / RSS), déployés par toi via **GitHub Actions** : [`docs/FREE_HOSTING.md`](docs/FREE_HOSTING.md)
(Cloudflare Worker/Pages, Vercel Hobby, Oracle Always Free, GitHub Pages).

## Sécurité & privacy (RGPD)

- **Zéro donnée** chez l’éditeur AscendOS (pas de BDD, pas de comptes)
- Données métier = localStorage de l’utilisateur
- Clés / tokens = coffre AES-GCM
- **Plafonds free-tier** automatiques (jamais forcer du payant)
- Export JSON sans secrets

Détail : [`docs/PRIVACY.md`](docs/PRIVACY.md) · [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/CONNECTORS.md`](docs/CONNECTORS.md) · [`docs/CV_LETTERS_AUTH.md`](docs/CV_LETTERS_AUTH.md).

## Stack

- HTML / CSS / JS vanilla (zéro build obligatoire)
- Stockage local (`localStorage` + coffre)
- Déploiement Actions → Pages

## Licence & avertissement

MIT — construis, fork, améliore.

**Usage personnel / éducatif / expérimental.** Tu es responsable du respect des lois et des ToS des plateformes.
Un bandeau « fair use » ne légalise pas le scrape non autorisé ni le contournement anti-bot — hors scope du projet.
→ [`docs/DISCLAIMER.md`](docs/DISCLAIMER.md)
