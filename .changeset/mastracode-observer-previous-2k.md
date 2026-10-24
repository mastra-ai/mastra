---
'@mastra/code-sdk': patch
---

The observer now sees the last 2,000 tokens of earlier observations (up from 1,000) each time it buffers new ones, so it repeats less of what is already recorded and keeps new observations consistent with recent ones.
