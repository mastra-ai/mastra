---
'@mastra/memory': patch
---

Fixed Observational Memory undercounting large tool results when deciding compaction thresholds.

Observational Memory uses token counts to decide when to buffer and compact conversation history. Large tool results were counted using the same 10k-token cap applied to Observer input, so pending token totals could stay below `messageTokens` / `blockAfter` even when the main model's next request would exceed the provider context window. Threshold accounting now uses the full provider-visible tool result size; Observer input remains capped.

Fixes #20930
