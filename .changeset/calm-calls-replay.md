---
'@mastra/core': patch
---

Fixed threads becoming unusable after a model sent a tool call with arguments that could not be parsed. `ProviderHistoryCompat` now sends any assistant tool call whose input is missing, `null` or an empty string as `{}` on every provider, so providers no longer reject the replayed history. The stored message is unchanged and the call keeps its error result.
