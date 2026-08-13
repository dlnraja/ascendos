# Connecteurs AscendOS

## Principe local-first

AscendOS sur GitHub Pages ne possède **pas** de backend. Tes données (CV, offres, tokens OAuth) restent dans le navigateur.

| Mode | Ce que ça fait | Quand l'utiliser |
|------|----------------|------------------|
| Import manuel | Coller texte LinkedIn / Gemini / CV | Toujours (fonctionne offline) |
| OAuth config | Stocke Client ID localement | Quand tu as créé des apps Google/LinkedIn |
| Blueprint `functions/` | Proxy OAuth + Gmail send | Production réelle |

## Gmail (Google Cloud)

1. [Google Cloud Console](https://console.cloud.google.com/) → créer un projet.
2. Activer **Gmail API**.
3. Credentials → OAuth 2.0 Client → type **Web application**.
4. Authorized JavaScript origins : `https://<user>.github.io` et `http://localhost:3000`.
5. Authorized redirect URIs : `https://<user>.github.io/ascendos/app.html` (et local).
6. Scopes demandés côté app : `gmail.compose` (brouillons) — pas `gmail.modify` tant que non nécessaire.
7. Coller le Client ID dans **App → Connecteurs**.

Sans backend, le flux PKCE peut ouvrir Google et récupérer un access token court ; l'envoi d'emails complexes reste plus fiable via le blueprint Functions.

## LinkedIn

1. [LinkedIn Developers](https://www.linkedin.com/developers/) → Create app.
2. Products : **Sign In with LinkedIn** (+ OpenID si dispo).
3. Redirect URL = URL de ton app Pages.
4. Coller Client ID dans Connecteurs.
5. Limite API : LinkedIn restreint fortement le scrape de profil. L'import **copier-coller** du profil public reste le chemin le plus fiable.

## Gemini / Google Workspace / autres IA

Pas d'API obligatoire. Workflow recommandé :

1. Dans Gemini / ChatGPT / Claude Workspace, demande :
   > « À partir de mon CV et de mon historique, produis un profil JSON avec : headline, summary, experiences[], skills[], languages[], target_roles[], career_goal. »
2. Colle le résultat dans **AI Vault**.
3. AscendOS parse le JSON ou le texte libre et enrichit ton profil.

Tu peux aussi exporter un `.md` / `.txt` depuis Google Docs et le coller.

## Blueprint backend (optionnel)

Voir `functions/README.md` pour un Worker Cloudflare minimal qui :

- échange `code` OAuth → tokens
- stocke refresh token chiffré côté user (KV)
- envoie des brouillons Gmail
- ne log jamais le corps des CV
