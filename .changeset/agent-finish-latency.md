---
'@mastra/core': patch
---

Reduce agent response latency by making post-finish persistence non-blocking and deduplicating repeated finish handling for the same run.
