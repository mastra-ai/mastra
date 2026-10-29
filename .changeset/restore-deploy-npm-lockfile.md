---
'@mastra/deployer': patch
---

Restored `package-lock.json` generation in `.mastra/output` for projects that don't use npm (pnpm, Yarn, Bun). Deploy targets that install with npm, such as Mastra Cloud, can use the lockfile again instead of resolving fresh dependency versions on every deploy.
