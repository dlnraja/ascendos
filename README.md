# AscendOS

**De l'ESN aux grands groupes.** Une plateforme open-source (GitHub Pages) qui unifie les fonctions des outils type AIApply, CandiBoost, CV Boost, FastApply, LoopCV, JobCopilot, Teal, Jobscan et l'optimisation LinkedIn — avec un focus unique : viser des postes **accélérateurs de carrière**.

## Pourquoi AscendOS

La plupart des auto-apply maximisent le volume. AscendOS maximise le **levier de carrière** :

| Signal | Exemple |
|--------|---------|
| Employeur cible | Client final / grand groupe > ESN / cabinet |
| Séniorité | Mount (Senior → Lead → Manager) vs lateral |
| Gratification | Scope produit, impact, package, ownership |
| Fit ATS | Match mots-clés Jobscan-like avant envoi |
| Pipeline | Tracker type Teal + file d'apply contrôlée |

Exemple : un profil qui n'a fait que de l'**ESN** peut cibler des **grands groupes clients finaux** (banque, industrie, tech produit, luxe, énergie…) et filtrer automatiquement les missions « body shopping ».

## Modules (inspirations → AscendOS)

| Inspiration | Module AscendOS |
|-------------|-----------------|
| Jobscan | **ATS Match** — score CV ↔ offre, gaps mots-clés |
| Teal | **Pipeline** — kanban Saved → Offer |
| AIApply / CV Boost / CandiBoost | **CV Studio** + lettres + réponses formulaires |
| LinkedIn Profile tools | **LinkedIn Boost** — headline / about / expériences |
| FastApply / LoopCV / JobCopilot | **Apply Queue** — file priorisée, revue humaine avant envoi |
| Gmail | **Connecteur Gmail** — brouillons d'outreach recruteurs |
| LinkedIn | **Connecteur LinkedIn** — import profil / export ciblé |
| Gemini / Workspace / autres IA | **AI Vault** — coller un profil « décrypté » par Gemini ou autre |

## Démarrage local

Ouvre `index.html` dans le navigateur, ou :

```bash
npx --yes serve .
```

Puis va sur `http://localhost:3000`.

## GitHub Pages

1. Crée un repo `ascendos` sur ton compte GitHub.
2. Pousse ce dossier.
3. Settings → Pages → Source : **GitHub Actions** (workflow fourni).
4. L'app sera sur `https://<user>.github.io/ascendos/`.

## Connecteurs (sécurité)

Sur une GitHub Page **statique**, les OAuth Gmail/LinkedIn nécessitent des Client IDs que **toi seul** configures :

1. Ouvre **App → Connecteurs**.
2. Colle tes Client IDs (Google / LinkedIn) — stockés **uniquement** dans ton navigateur (`localStorage`).
3. Ou utilise le mode **import manuel** (recommandé pour commencer) :
   - Coller le profil LinkedIn / PDF texte
   - Coller l'export Gemini / Google Workspace (« résume mon profil pro »)
   - Importer un `.json` AscendOS

Aucun token n'est envoyé à un serveur AscendOS : tout reste local (local-first).

Pour un OAuth complet (refresh tokens, envoi Gmail réel), déploie le blueprint `functions/` (Workers / Cloud Functions) — voir `docs/CONNECTORS.md`.

## Stack

- HTML / CSS / JS vanilla (zéro build obligatoire)
- Stockage local (`localStorage`)
- Déployable en un clic sur GitHub Pages

## Licence

MIT — construis, fork, améliore.
