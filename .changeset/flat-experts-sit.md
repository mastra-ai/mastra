---
'@mastra/core': patch
---

Fixes how reasoning chunks are stored in memory to prevent data loss and ensure they are consolidated as single message parts rather than split into word-level fragments.
