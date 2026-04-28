---
'@mastra/observability': patch
---

Fixed `inputDetails.cacheWrite` reflecting only the final step's cache-write tokens in multi-step Anthropic prompt-caching runs (e.g. subagent and workflow flows). Trace `inputDetails.cacheWrite` and the derived input-token totals now reflect the full multi-step run, so cost accounting in Langfuse and other exporters matches what Anthropic actually charged.
