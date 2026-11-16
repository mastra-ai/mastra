---
'@mastra/core': patch
---

Fixed durable agent runs with storage-backed run ownership being reported as lost after they suspend, which left the following `resume()` streaming nothing and never finishing. This happened when a lease renewal sent just before the suspension reached storage after the run had already released its claim, most often with storage whose new connections are slow to open. Evented agent runs were affected the same way, including when the worker that released the run is in a different process from the API. A late renewal is now ignored when storage shows the run's own release made it fail, and `resume()` streams to its finish. A renewal rejected because another execution took the run over still stops the run.

When run ownership is only a pubsub lease (storage without run fencing), a late renewal after the run released its claim still counts as a loss, as before. Fixes [#30206](https://github.com/mastra-ai/mastra/issues/30206).
