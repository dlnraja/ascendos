# Sécurité AscendOS

AscendOS tourne en **local-first** (GitHub Pages). Les secrets ne doivent jamais être commités ni stockés en clair.

## Coffre (`assets/js/security.js`)

| Élément | Protection |
|---------|------------|
| API keys (email, offres…) | AES-GCM 256 dans `localStorage` (`ascendos.vault.v1`) |
| OAuth Client IDs | Idem |
| URL agrégateur | Idem |
| OAuth access tokens | Mémoire + blob session chiffré si coffre ouvert ; **jamais** dans le vault long-terme ni l’export |
| État app (CV, jobs…) | `ascendos.v1` **sans** secrets |

### Modes

1. **Device (défaut)** — clé AES non extractible dans IndexedDB. Protège contre un dump `localStorage` / sync navigateur naïf.
2. **Passphrase** — PBKDF2-SHA256 (310k itérations) + AES-GCM. Requis pour magic links chiffrés + auto-lock 15 min.

### Actions UI (Connecteurs)

- Activer passphrase / Déverrouiller / Verrouiller
- Effacer secrets (wipe vault + tokens)
- Révoquer token session OAuth
- Export JSON **redacté** (aucune clé)

## OAuth

- Paramètre `state` anti-CSRF (nonce session, TTL 15 min)
- Fragment `#access_token=…` **effacé immédiatement** (pas de fuite Referer / historique)
- Token legacy `sessionStorage.ascendos.oauth` migré puis purgé

## Magic links

| Version | Contenu |
|---------|---------|
| v1 | Payload compact en clair — à éviter |
| v2 | AES-GCM + salt PBKDF2 — **recommandé** (même passphrase que le coffre) |

Ouvrir un lien v2 demande la passphrase avant d’injecter les secrets dans le coffre.

## CSP & headers navigateur

`app.html` pose une CSP stricte (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) + `Referrer-Policy: no-referrer`.

Les appels `connect-src https:` restent nécessaires (sources d’offres, APIs optionnelles, DoH…).

## Bonnes pratiques

1. Active une **passphrase** dès que tu ajoutes une clé API.
2. Ne partage jamais un magic link (même chiffré) hors appareils à toi.
3. Préfère un Worker / Vercel pour les clés Adzuna côté serveur si tu exposes l’agrégateur publiquement.
4. Certaines APIs passent la clé en query : limite l’usage, révoque périodiquement.
5. Après une machine partagée : **Verrouiller** ou **Effacer secrets**.

## Limites (honnêtes)

Sur une page statique, un XSS dans le même origin peut lire la mémoire tant que le coffre est déverrouillé. La CSP + pas de scripts tiers réduisent la surface. Un backend OAuth (voir `functions/`) reste le modèle le plus sûr pour les refresh tokens.
