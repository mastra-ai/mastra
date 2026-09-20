---
'@mastra/core': minor
---

Deprecated the reactive repair on the built-in Anthropic tool-call ID rule. Invalid IDs are now rewritten in the outbound request, so they no longer reach Anthropic and no longer require a failed call to recover. Persisted history keeps its original IDs.
