# Avertissement — usage, responsabilité & limites légales

**AscendOS est un logiciel open-source fourni « en l’état » (MIT), à des fins personnelles, éducatives et expérimentales.**

Ce document **ne constitue pas un conseil juridique**. Un bandeau « fair use / éducatif » **ne rend pas légal** ce qui est interdit par la loi ou par les conditions d’utilisation (ToS) d’un tiers.

---

## 1. Qui est responsable ?

| Sujet | Responsable |
|-------|-------------|
| Données dans ton navigateur (CV, offres, mails collés…) | **Toi** |
| Respect des ToS des sites / APIs que tu appelles | **Toi** |
| Clés API, OAuth, backends que tu déploies (CF / Vercel / Oracle) | **Toi** |
| Code open-source distribué sans BDD AscendOS | Éditeur du dépôt : pas de traitement des données fin-utilisateurs (voir [`PRIVACY.md`](PRIVACY.md)) |
| Fork qui ajoute comptes / scrape / stockage cloud | **L’auteur du fork** devient responsable |

En utilisant AscendOS, tu acceptes d’utiliser l’outil **à tes propres risques** et de vérifier la légalité de ton usage dans ton pays.

---

## 2. Usage prévu (OK)

- Gestion de carrière **locale** (profil, file d’apply, CV / lettres honnêtes)
- Appels à des **APIs / RSS documentés et autorisés** (Remotive, RemoteOK, etc. selon leurs règles)
- Collage manuel de contenus **qui te concernent** (export LinkedIn, Docs, mails)
- Backends auto-hébergés free-tier **sans PII** (`/aggregate`)
- Tests éducatifs / expérimentaux **sur ton propre compte / tes propres données**

---

## 3. Hors scope — explicitement non supporté

AscendOS **n’inclut pas** et **n’autorise pas** dans ce dépôt :

- Contournement anti-bot / captcha / WAF
- Scraping non autorisé de réseaux sociaux, ATS ou sites protégés
- OSINT ou collecte ciblant des **tiers** sans base légale
- Accès non autorisé à des systèmes, comptes ou données d’autrui
- Spam, autofill + submit automatique abusif, usurpation d’identité

Un disclaimer « fair use » ou « pour la science » **ne transfère pas** la responsabilité vers GitHub, Cloudflare, Vercel, Oracle ni vers l’éditeur AscendOS.

---

## 4. Fair use / droit d’auteur (rappel)

Le « fair use » (ou exceptions pédagogiques / citation selon les juridictions) est **étroit**, factuel et **non automatique**.  
Réutiliser le contenu d’autrui (offres, profils, textes) reste soumis au droit d’auteur, au RGPD / ePrivacy et aux ToS des plateformes.  
AscendOS ne garantit **aucun** droit d’usage sur les contenus tiers.

---

## 5. Sources d’offres & connecteurs

- Respecte les quotas, attributions et conditions de chaque source
- Ne place aucune donnée personnelle dans l’agrégateur optionnel
- Révoque tes tokens OAuth et clés si tu partages une machine

Voir [`FREE_HOSTING.md`](FREE_HOSTING.md) · [`CONNECTORS.md`](CONNECTORS.md) · [`JOB_SOURCES.md`](JOB_SOURCES.md).

---

## 6. Expérimental

Fonctionnalités marquées locales / expérimentales peuvent changer, être incomplètes ou produire des faux positifs (match ATS, email guess, etc.).  
**Vérifie toujours** avant d’envoyer une candidature ou un message.

---

## 7. Licence

Code : **MIT** — voir [`LICENSE`](../LICENSE).  
Aucune garantie de conformité réglementaire pour ton cas d’usage particulier.
