---
'mastra': patch
---

Fixed `mastra studio deploy` reporting raw version specifiers (e.g. `catalog:`, `workspace:*`) instead of the actual installed version. The deploy command now resolves the real semver version from node_modules.
