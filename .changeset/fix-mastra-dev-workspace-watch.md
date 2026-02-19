---
'@mastra/deployer': patch
---

Fixed `mastra dev` not detecting changes to workspace packages in monorepo setups. Workspace dependency source files are now included in Rollup's watch graph, so editing a shared package triggers an automatic rebuild.
