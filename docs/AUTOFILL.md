# AutoFill CRM & portails carrière

## Principe

AscendOS fusionne :
- profil **LinkedIn** (collé / import)
- profil **IA Workspace / Gemini** (AI Vault)

…en un **fill pack** (identité, LinkedIn URL, résumé, skills, lettre, etc.) mappé sur les noms de champs des ATS courants.

## Limitation GitHub Pages

Une page statique **ne peut pas** injecter du JS dans `greenhouse.io` / `workday` depuis son origine.
Solution fournie :
1. **Bookmarklet** — à cliquer *sur* la page de candidature
2. **Export JSON / CSV** — pour extensions ou usage manuel
3. Bouton **Pack AutoFill CRM** depuis Apply Queue

## Portails couverts (heuristiques)

Greenhouse, Lever, Workday, SmartRecruiters, Taleo, SuccessFactors, iCIMS, Ashby, Teamtailor, Welcome to the Jungle, Indeed, LinkedIn Easy Apply + générique.

## Sécurité / éthique

- Pas d'auto-submit : tu vérifies avant envoi
- Pas d'invention de faits : seules les données du profil AscendOS
- Upload fichier CV reste manuel (navigateur)
