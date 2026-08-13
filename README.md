# AscendOS

**De l'upgrade réel, pas du lateral move.** Plateforme open-source (GitHub Pages) qui unifie AIApply, Teal, Jobscan, LinkedIn, apply queue + **Email Finder** — avec un moteur **multi-vecteurs de carrière** (pas seulement ESN → client final).

## Pourquoi AscendOS

La plupart des auto-apply maximisent le volume. AscendOS maximise le **levier de carrière** via des vecteurs inspirés des patterns qui marchent vraiment (career capital, tour of duty, ownership, marque, séniorité, compensation…) :

| Vecteur (exemples) | Ce que ça filtre |
|--------|---------|
| Employeur | Client final, marque CV, produit vs agence, scale-up |
| Niveau | Titre +1, management, Staff IC, scope P&L, stratégie |
| Capital | Skills rares, réseau, credentials, plateforme suivante |
| Économie | Package, autonomie, stabilité |
| Direction | Pivot industrie, impact, founder path |

Tu actives **tes** vecteurs dans le profil ; chaque offre est scorée dessus. Doc : [`docs/CAREER_VECTORS.md`](docs/CAREER_VECTORS.md).

## Modules (inspirations → AscendOS)

| Inspiration | Module AscendOS |
|-------------|-----------------|
| Jobscan | **ATS Match** — score CV ↔ offre, gaps mots-clés |
| Teal | **Pipeline** — kanban Saved → Offer |
| AIApply / CV Boost / CandiBoost | **CV Studio** + lettres + réponses formulaires |
| LinkedIn Profile tools | **LinkedIn Boost** — headline / about / expériences |
| FastApply / LoopCV / JobCopilot | **Apply Queue** — file priorisée, revue humaine avant envoi |
| Hunter / Apollo (esprit) | **Email Finder RH/CP** — nomenclature groupe + noms LinkedIn → mails |
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
