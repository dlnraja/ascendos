# One-Click workflows

AscendOS ouvre sur **One-Click** : un workflow, un gros bouton. Les outils fins restent dans **Atelier**.

## Workflows

| Id | Bouton | Enchaînement |
|----|--------|----------------|
| `morning_sprint` | Lancer le sprint | Vecteurs → frais → file PRIME → lettre → readiness → AutoFill |
| `apply_prime` | File PRIME maintenant | Classement frais × levier → file → readiness |
| `candidature_pack` | Préparer le pack | Meilleure offre → CV → lettre → entretien → AutoFill → emails → readiness |
| `profile_boost` | Optimiser mon cap | Vecteurs → passerelles → LinkedIn |
| `interview_ready` | Générer la prépa | Meilleure offre → pack entretien STAR |

## Fiche offre

Chaque offre ouvre un hub local : package détecté, score Ready, lettre, prépa entretien, ATS, AutoFill.

## Nav

1. **One-Click** · **Évolutions** · **Fiche offre** · Vue rapide · Pipeline · Apply  
2. **Atelier** — le reste  

## Code

- `assets/js/workflows.js` — définitions  
- `assets/js/comp-signal.js` · `readiness.js` · `cover-letter.js` · `interview-prep.js` · `weekly-plan.js`  
- `assets/js/app.js` — orchestration + fiche  
