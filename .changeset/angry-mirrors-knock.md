---
'@mastra/deployer': patch
---

Fixed `mastra build` so deploy output keeps its installed dependencies, preventing `mastra start` and `wrangler dev` from failing on missing packages.
