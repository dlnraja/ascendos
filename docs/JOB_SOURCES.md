# Sources d'offres fraîches (agrégation polie)

## Principe AscendOS

On agrège **un maximum de sources légitimes** (API JSON + RSS officiels + tes flux perso), avec :

- throttle local par source
- cache `localStorage`
- pauses entre appels
- respect HTTP 429
- **pas** de contournement anti-bot / proxies / scrape LinkedIn ou X

Contourner Cloudflare / CAPTCHA / bans pour scraper n'est **pas** supporté.

## Sources intégrées

| Source | Type | Notes fraîcheur / gratuit |
|--------|------|---------------------------|
| Remotive | API | Souvent ~24h de délai (ToS). Créditer + lien. |
| Remote OK | API + RSS | Feed public. Créditer. |
| Arbeitnow | API | EU / remote, CORS OK |
| Jobicy | API + RSS | ≤ 1 req/heure recommandé |
| Himalayas | API + RSS | Refresh ~24h ; 429 si abus |
| We Work Remotely | RSS | Catégories RSS officielles |
| HN Algolia | API | Who's Hiring — pas du sub-hour |
| Adzuna | API clé | Freemium — APP_ID/KEY dans Connecteurs |
| RSS perso | RSS | Alertes carrière, RssHub **auto-hébergé**, listes…

## Twitter / X & LinkedIn

- **Pas de scrape** AscendOS.
- Pour X : utilise un bridge que **tu** contrôles (RssHub self-hosted, export liste → RSS) et colle l'URL dans « RSS perso ».
- LinkedIn Jobs : pas d'API publique stable pour candidats — ajoute manuellement / Easy Apply + fraîcheur PRIME.

## Quotas

Le client refuse de re-fetch une source avant son `minIntervalMs` et sert le cache.
Forcer trop souvent = 429 côté fournisseur, pas un « filtre à passer ».
