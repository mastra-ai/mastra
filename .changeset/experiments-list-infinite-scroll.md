---
'@internal/playground': patch
---

Fixed the Studio experiments list stopping at the first 100 experiments. The list now loads more as you scroll to the bottom, so older runs are reachable again, both on the global list and when it is filtered by dataset. Fixes [#22984](https://github.com/mastra-ai/mastra/issues/22984).
