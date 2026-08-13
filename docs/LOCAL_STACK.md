# Stack locale (sans connecteurs)

**Règle produit :** aucune fonctionnalité critique ne doit exiger une clé, un OAuth Client ID ou un backend.

| Besoin | Sans connecteur | Avec connecteur (upgrade) |
|--------|-----------------|---------------------------|
| Radar offres | Remotive, RemoteOK, RSS… dans le navigateur | Worker / Vercel `/aggregate` |
| Adzuna | Ignoré (`skipped_no_key`) | APP_ID + APP_KEY |
| Emails | Permutator + cartes + MX DoH | Hunter / Under IA |
| Session | Profil local | Google OAuth |
| LinkedIn | URL / nom locaux | Client ID OAuth |
| Mail | `mailto:` / Gmail web | **Envoi via ton Gmail** (OAuth `gmail.send`) |

Envoi Gmail : `assets/js/gmail-send.js` — confirmation humaine, token local, fallback mailto si down / pas connecté.

| CV / lettres / AutoFill | 100 % local | — |

Moteur : `assets/js/local-stack.js` (`LocalStack.aggregateJobs`, `resolveEmails`, `bindLocalSession`, `openMailDraft`).

## Si un service / hébergeur est down

`assets/js/resilience.js` :

| Mécanisme | Effet |
|-----------|--------|
| Timeout (~9s) | Pas de freeze UI |
| Circuit breaker | Host en échec → cooldown 15 min |
| Soft-fail par source | Remotive KO ≠ RemoteOK KO |
| Cache offline | Sert les offres déjà vues |
| Backend Worker/Vercel down | Fallback navigateur auto |
| DNS / Hunter / Wikidata down | Permutator / profil / CV continuent |

**L’app locale (profil, CV, lettres, file, AutoFill, login) ne dépend d’aucun hébergeur externe.**
