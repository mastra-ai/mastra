---
'@mastra/core': patch
---

Fixed a subscription leak in DurableAgent. When a run finished, the auto-cleanup timer deleted the run's pubsub topic but never unsubscribed the stream reader, leaking one subscription per run (a dangling in-process listener, or a dedicated client connection and XREADGROUP loop on Redis/Valkey streams transports). `stream()`, `resume()`, and `recover()` now unsubscribe the reader when the auto-cleanup timer fires, matching `observe()`. Fixes #24070.
