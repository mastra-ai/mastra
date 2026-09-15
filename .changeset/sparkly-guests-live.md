---
'@mastra/core': patch
---

Improved default goal-judge retries by adding JSON instructions to the latest user message. The first attempt still selects the supported output format automatically. Validation remains strict. Other scorers keep their existing retry behavior.
