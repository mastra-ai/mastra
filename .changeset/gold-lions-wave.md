---
'@mastra/memory': patch
---

Observational memory: use async buffering in the threshold→blockAfter band instead of blocking sync observation. Previously, reaching the observation threshold without an activatable buffered chunk fell straight through to a blocking synchronous observer call — even when async buffering was enabled and pending tokens were far below `blockAfter`. Now, pending tokens between the threshold and `blockAfter` trigger background buffering (the resulting chunk is activated on a later step), and blocking sync observation is reserved for pending tokens at or above `blockAfter`. This matches the documented reflection `blockAfter` semantics and eliminates repeated blocking observer calls in long agent sessions.
