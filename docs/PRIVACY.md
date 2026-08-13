# Confidentialité & RGPD — zéro donnée chez l’éditeur

## Engagement

**L’éditeur / hébergeur du dépôt AscendOS ne possède aucune donnée personnelle des utilisateurs finaux.**

| Question | Réponse |
|----------|---------|
| Compte AscendOS ? | Non |
| Base de données utilisateurs ? | Non |
| CV / offres / emails stockés chez nous ? | Non — uniquement dans le navigateur de l’utilisateur |
| Cookies analytics AscendOS ? | Non |
| Qui est responsable des données locales ? | L’utilisateur (traitement sur son appareil) |

Sur GitHub Pages, seuls des **fichiers statiques** sont servis. Aucun backend AscendOS central ne reçoit de profils.

Voir aussi [`SECURITY.md`](SECURITY.md).

## Session optionnelle (Google / LinkedIn)

| Canal | Flux | Données chez AscendOS ? |
|-------|------|-------------------------|
| Google | Navigateur ↔ Google (OAuth + userinfo) | **Non** — jeton / identité en localStorage / session uniquement |
| LinkedIn | Liaison locale (URL / nom déjà saisis) | **Non** |
| Login mdp + JWT | PBKDF2 / AES-GCM / HS256 **sur l’appareil** | **Non** — scelle le store local au verrouillage |

Quitter la session efface l’identité liée sur l’appareil. Les données métier restent locales jusqu’à effacement volontaire.

## Quotas gratuits (jamais dépasser)

AscendOS **coupe** les appels avant les plafonds free / freemium (`assets/js/quotas.js`) :

| Ressource | Plafond local (conservateur) |
|-----------|------------------------------|
| API email recherches | 45 / mois |
| API email domain-search | 20 / mois |
| Adzuna | 40 / jour |
| Parseur RSS public | 20 / jour |
| DNS MX | 30 / heure |
| Agrégation offres | 4 runs / heure |
| Google userinfo | 20 / jour |

+ throttle par source d’offres (cache local). Les backends optionnels auto-hébergés refusent les payloads PII et limitent ~30 req/h/IP.

## Backend optionnel (auto-hébergé)

Si tu déploies un Worker / Vercel **pour toi** :

- uniquement `query` / `hours` / `sources` / `rss` ;
- **interdiction** profil, email, CV, tokens ;
- pas de stockage durable des requêtes ;
- `privacy: "no_user_data_stored"` dans la réponse.

Ce n’est **pas** un cloud AscendOS multi-locataires : c’est *ton* instance.

## Base légale (lecture)

Pour l’éditeur du projet open-source distribué en statique : **pas de traitement** de données des utilisateurs finaux → pas de rôle de responsable de traitement sur ces données. Chaque utilisateur traite ses propres données sur son terminal.

Si tu forks et ajoutes un backend qui stocke des comptes : **tu** deviens responsable et dois documenter RGPD / DPA — hors scope du design AscendOS local-first.
