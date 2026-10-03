---
'@mastra/redis': patch
---

Sped up listing messages across multiple threads by fetching each thread's message list in parallel instead of one after another. Fixes #23752
