---
'@mastra/core': minor
---

Added `modelSettings.timeout.firstChunkMs` so you can bound how long a streaming model call may take to produce its first content. Stream-start and metadata chunks don't count; the budget is only satisfied by the first text, reasoning, tool call, file or source chunk. Going over the limit fails with a `MastraTimeoutError` whose `timeoutType` is `'firstChunk'`. Like `stepMs`, it's not retried against the same model but does move on to the next entry in `models` when fallback models are configured, and each provider retry attempt gets a fresh budget. Nested `timeout` settings are now merged per key across call-time and per-model `modelSettings`, so a per-model `stepMs` override no longer discards a call-time `firstChunkMs`. Closes #23072
