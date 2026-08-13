# Stack locale (sans connecteurs)

**Règle produit :** aucune fonctionnalité critique ne doit exiger une clé, un OAuth Client ID ou un backend.

## Une logique pour tous les modules

Tous les chemins passent par la façade **`AscendCore`** (= `LocalStack` dans [`assets/js/local-stack.js`](../assets/js/local-stack.js)) :

1. Essayer l’upgrade (connecteur / clé / hébergeur) si présent  
2. Soft-fail + timeout / circuit breaker ([`resilience.js`](../assets/js/resilience.js))  
3. Compensation locale (permutator, cache, mailto, profil)  
4. **Jamais** bloquer CV / file / profil / AutoFill  

```text
UI / workflows / batch / freshness
        ↓
   AscendCore (LocalStack)
        ↓
  try optional API / OAuth / Worker
        ↓ on fail or missing
  local engine → localStorage vault
```

| API façade | Usage |
|------------|--------|
| `AscendCore.jobs.aggregate` | Radar (backend → navigateur → cache) |
| `AscendCore.email.resolve` / `.send` / `.prepareOutreach` / `.checkMx` | Finder + Gmail confirm / mailto / MX |
| `AscendCore.session.ensure` | Session locale ou OAuth |
| `AscendCore.enrich.public` | Wikidata soft-fail |
| `AscendCore.docs.cv` / `.letter` | CV / lettres locaux |
| `AscendCore.capabilities()` / `.health()` / `.stackSummary()` / `.statusChipsHtml` | Chips **local / upgrade / cooldown** |

Alias rétrocompatibles : `LocalStack.aggregateJobs`, `resolveEmails`, `bindLocalSession`.

Voir aussi [`DISCLAIMER.md`](DISCLAIMER.md) : pas de contournement anti-bot / ATS.

## Capacités sans / avec connecteur

| Besoin | Sans connecteur | Avec connecteur (upgrade) |
|--------|-----------------|---------------------------|
| Radar offres | Remotive, RemoteOK, RSS… dans le navigateur | Worker / Vercel `/aggregate` |
| Adzuna | Ignoré (`skipped_no_key`) | APP_ID + APP_KEY |
| Emails | Permutator + cartes + MX DoH | Hunter / Under IA |
| Session | Profil local | Google OAuth |
| LinkedIn | URL / nom locaux | Client ID OAuth |
| Mail | `mailto:` / Gmail web | **Envoi via ton Gmail** (OAuth `gmail.send`) |
| CV / lettres / AutoFill | 100 % local | — |
| Import profil | Collage texte (pas d’API) | — |

Envoi Gmail : [`assets/js/gmail-send.js`](../assets/js/gmail-send.js) — confirmation humaine, token local, fallback mailto si down / pas connecté. Le batch **prépare** l’outreach, **n’envoie jamais** automatiquement.

## Si un service / hébergeur est down

[`assets/js/resilience.js`](../assets/js/resilience.js) :

| Mécanisme | Effet |
|-----------|--------|
| Timeout (~9s) | Pas de freeze UI |
| Circuit breaker | Host en échec → cooldown 15 min |
| Soft-fail par source | Remotive KO ≠ RemoteOK KO |
| Cache offline | Sert les offres déjà vues |
| Backend Worker/Vercel down | Fallback navigateur auto |
| DNS / Hunter / Wikidata down | Permutator / profil / CV continuent |

**L’app locale (profil, CV, lettres, file, AutoFill, login) ne dépend d’aucun hébergeur externe.**
