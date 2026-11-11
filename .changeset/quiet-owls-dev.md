---
'mastra': patch
---

Fixed `mastra dev` loading the deployer from `src/mastra/index.ts` when the project has file-based agents. The dev server now leaves it out, as it does for projects without file-based agents.
