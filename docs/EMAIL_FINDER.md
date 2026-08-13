# Email Finder RH / Chef de projet

Objectif : candidater sur le **CRM / ATS** de l'entreprise **et** envoyer un **mail direct** à un RH, recruteur ou chef de projet.

## Workflow

1. Trouve sur internet des emails publics d'employés du même groupe (pages équipe, communiqués, PDF, signatures…).
2. Colle-les dans **Email Finder → Apprendre la nomenclature**.
3. AscendOS détecte le pattern dominant : `prenom.nom@`, `p.nom@`, `prenom_nom@`, etc.
4. Sur LinkedIn, relève le prénom/nom d'un RH ou CP lié à l'offre.
5. Génère les emails candidats + boîtes génériques (`rh@`, `recrutement@`, `talent@`…).
6. Sauve le contact → il apparaît dans **Apply Queue** pour un **mail dual** (texte « en complément du CRM »).

## Limites (GitHub Pages)

- Pas de vérification SMTP serveur depuis le navigateur (anti-spam / CORS).
- Les emails sont des **hypothèses** classées par confiance — envoie d'abord au plus probable, reste courtois.
- Respecte le RGPD / canaux professionnels : usage outreach candidature, pas de spam de masse.

## Patterns supportés

`prenom.nom`, `prenomnom`, `p.nom`, `pnom`, `nom.prenom`, `nomp`, `prenom_nom`, `prenom-nom`, `prenom`, `nom`, `p_nom`, `prenom.n`
