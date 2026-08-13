# Email Finder — gratuit & intelligent

Inspiré de **Hunter** (permutator + pattern domaine + crédits free), **Apollo** (crédits free), et des **email permutators** 100% locaux.

## Ce qu'AscendOS fait sans payer

| Capacité | Comment |
|----------|---------|
| Permutator | 15 formats (`prenom.nom`, `p.nom`, `pnom`…) |
| Cartes de visite / vCard / signatures | Parse nom, titre, société, email, site → nomenclature |
| Samples web | Emails publics employés → pattern dominant du groupe |
| MX check | DNS-over-HTTPS Cloudflare (domaine accepte le mail) |
| Boîtes génériques | `rh@`, `recrutement@`, `commercial@`… |
| Hunter free (optionnel) | Ta clé API → email-finder + domain-search (50/mois) |

## Cartes commerciaux

Colle :
```
Camille Moreau
Chargée d'affaires
Acme SAS
camille.moreau@acme.fr
06 12 34 56 78
www.acme.fr
```
ou un bloc `BEGIN:VCARD`… → **Parser carte → formulaire**.

## Limites honnêtes

- Un guess ≠ email vérifié SMTP (pas de spam probe).
- Hunter/Apollo free = crédits limités ; le permutator local est illimité.
- Pas de scrape de bases privées.
