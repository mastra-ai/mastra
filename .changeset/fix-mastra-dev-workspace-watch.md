---
'@mastra/deployer': patch
---

Fixed `mastra dev` not detecting changes to workspace packages in monorepo setups. Workspace package source and dist files are now watched via Rollup's `addWatchFile` API, so editing a shared package triggers an automatic rebuild without changing how workspace dependencies are bundled.
