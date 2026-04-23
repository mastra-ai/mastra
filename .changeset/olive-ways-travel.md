---
'@mastra/deployer': patch
---

Fixed transitive npm dependencies of workspace packages not being discovered during bundle analysis. When a workspace package (e.g. `@eddi/forge`) imports an npm package (e.g. `@prisma/client`), that dependency is now correctly included in the analysis results so it can be externalized or installed at runtime. Previously this caused a "couldn't load" error during `mastra dev` or `mastra build` in monorepo setups.
