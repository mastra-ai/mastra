---
'@mastra/memory': patch
---

**Fixed** Observer tool-result truncation stalling for seconds on multi-megabyte tool results. The truncation search now bounds its token counting to the result budget instead of re-counting a near-full copy of the result on every step, so large results are trimmed to the same budget in milliseconds. Fixes #30951
