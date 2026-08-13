# Radar frais — postuler en premier

## Idée

Les offres **< 1 h** (PRIME) et **< 24 h** ont souvent moins de candidats dans l'ATS.
AscendOS combine **fraîcheur** + **score d'upgrade carrière** → urgence `apply_now`.

## Tiers

| Tier | Âge | Signal |
|------|-----|--------|
| PRIME | < 1 h | Postule immédiatement si levier carrière OK |
| HOT | < 6 h | Fenêtre chaude |
| 24h | < 24 h | Encore frais |
| 72h | < 72 h | Warm |
| STALE | plus | Traiter après |

## Modes

1. **Manuel** — à l'ajout d'offre, choisis la fraîcheur (défaut `< 1 h`).
2. **Parse texte** — détecte « il y a 20 min », « today », dates ISO dans la description.
3. **Scan Remotive** — API publique remote jobs filtrée sur la fenêtre (ex. 24 h).
4. **Apply Queue** — tri automatique frais + levier ; PRIME en tête.

## Réglages

- Fenêtre (heures)
- Score carrière minimum avant de prioriser
- `freshFirst` dans settings (défaut ON)
