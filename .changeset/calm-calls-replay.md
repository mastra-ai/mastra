---
'@mastra/core': patch
---

Added a `ProviderHistoryCompat` safeguard that sends an assistant tool call whose stored input is missing or `null` as `{}` on every provider, so a stored row without input can't make providers reject the replayed history. The stored message is unchanged, the call keeps its error result, and an empty-string input is left as it is.
