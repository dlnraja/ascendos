# Email Finder

Recherche d’emails RH / CP / managers — **local-first**, **zéro clé obligatoire**, **zéro dépendance npm**.

## Capacités (sans clé)

| Capacité | Comment |
|----------|---------|
| Permutator | 19 formats (`prenom.nom`, `p.nom`, `pnom`…) + boîtes rôle |
| Cartes FR | Labels Société / Fonction / Tél / Mail |
| vCard | `BEGIN:VCARD` (FN, N, ORG, TITLE, EMAIL, TEL, URL) |
| Signatures | Après « Cordialement » / « Best regards » / `--` |
| Samples publics | Emails visibles → nomenclature domaine |
| MX check | DNS-over-HTTPS (Cloudflare → fallback Google) |
| Export | CSV, JSON complet (+ catalogue patterns), copie |

## APIs optionnelles (coffre Connecteurs)

| API | Champs | Si absente |
|-----|--------|------------|
| Hunter.io | `hunter-api-key` | Permutator local |
| Under IA | `under-ia-base` + `under-ia-key` | Permutator local |

Under IA : `GET {base}?domain=&first_name=&last_name=&api_key=` → `{ email }` ou `{ data: { email } }`.

## Limites

- Un guess ≠ email vérifié SMTP.
- Pas de scrape de bases privées.
- Voir [`DISCLAIMER.md`](DISCLAIMER.md).
