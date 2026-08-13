# Connecteurs AscendOS

## Session optionnelle (privacy)

AscendOS **n’a pas de base utilisateurs**. Une session Google (OAuth identité) ou une liaison LinkedIn locale sert seulement à afficher qui utilise *cet* appareil. Voir [`PRIVACY.md`](PRIVACY.md).

## Principe

Sur GitHub Pages (statique), **pas de backend secret**. Deux chemins simples :

1. **One-click / deep links** — ouvrir mail, réseau pro, vault IA, portails API…
2. **Magic link chiffré** — URL `#ml.…` (AES-GCM) qui injecte Client IDs + clés API après passphrase.

Les secrets vivent dans le **coffre** — voir [`SECURITY.md`](SECURITY.md).

| Mode | Ce que ça fait |
|------|----------------|
| One-click | Deep link service |
| Magic link v2 | Payload chiffré (passphrase) |
| OAuth 1-clic | Client ID depuis le coffre + `state` anti-CSRF |
| Avancé | Formulaire clés (replié) → sauve dans le coffre |
| Import manuel | Coller profil / export IA dans Profil Vault |

## Magic link

1. Connecteurs → **Activer passphrase** (≥ 8 caractères).
2. Remplir les clés (avancé) → **Sauver dans le coffre**.
3. **Copier magic link chiffré**.
4. Sur un autre appareil : coller le lien + passphrase → **Appliquer**.

> Ne partage un magic link qu’avec toi-même.

## One-click

| Bouton | Action |
|--------|--------|
| Ouvrir mail | Deep link compose |
| Connecter mail | OAuth implicite + nonce `state` |
| Ouvrir réseau pro | Profil |
| Connecter OAuth | Si Client ID présent |
| Vault IA | Prompt AscendOS + ouverture IA |
| Clés API | Pages free-tier → coller dans le coffre |

## OAuth mail (optionnel)

1. Console cloud → client OAuth Web.
2. Origins / redirect = ton URL Pages + `app.html`.
3. Scope compose / brouillons.
4. Client ID → coffre → magic link chiffré.

Le token access est stocké de façon sécurisée en session (pas d’export JSON).

## Réseau pro

L’API officielle reste limitée : collage de profil + one-click restent les plus fiables.

## Blueprint backend (optionnel)

Voir `functions/README.md` pour refresh tokens / envoi mail réel.
