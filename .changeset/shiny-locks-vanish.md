---
'create-factory': patch
---

Stop shipping `pnpm-workspace.yaml` and `package-lock.json` in projects scaffolded by `npm create factory`. The template generator now excludes the web project's pnpm workspace marker and lockfiles, and the sync workflow validates the template in a throwaway copy so `npm install` artifacts can no longer leak into the published template repository.
