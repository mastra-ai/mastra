---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed workflows support. Workflows placed in `workflows/*.ts` under the mastra directory are now auto-discovered and registered during `mastra dev` / `mastra build`, matching the existing file-based agents convention. Code-registered workflows win on name collisions.
