---
'@mastra/cli': patch
---

Fixed `mastra env vars pull <env>` writing the production environment's values when you pull a different environment. Pulling `qa` now gives you QA's values for every variable, including the ones production also defines.

Projects still on the legacy deploy pipeline keep pulling their project-level variables, which is what their deploys run with.
