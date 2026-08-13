# CV, lettres & login local

## CV par offre

- Génère un CV depuis profil + vault + formations + prefs lieu + **mémoire candidatures**
- **Ne invente jamais** d’expérience, diplôme ou métrique
- Édition manuelle + corrections en langage naturel (`retire…`, `remplace A par B`, `raccourcis`, `moins commercial`)
- **PDF** : ouverture impression navigateur (Enregistrer en PDF)

## Lettres

Même logique honnête, enrichie des retours mails / refus / entretiens locaux.

## Mémoire candidatures

Dans CV Studio : enregistre résultat + extrait mail → réinjecté dans les prochains docs.

## Login (anti-piratage) — sans compte AscendOS

| Méthode | Détail |
|---------|--------|
| Mot de passe | PBKDF2 + AES-GCM ; verrouillage scelle `localStorage` |
| JWT local | HS256, TTL 8 h, `sessionStorage` uniquement |
| Google OAuth | Navigateur → Google ; JWT local après userinfo |
| LinkedIn | Liaison locale / OAuth provider ; JWT local |

**Aucun serveur AscendOS** ne stocke comptes, mots de passe ou JWT. Voir [`PRIVACY.md`](PRIVACY.md) · [`SECURITY.md`](SECURITY.md).
