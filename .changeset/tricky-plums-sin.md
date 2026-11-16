---
'@mastra/core': patch
---

Fixed durable agent runs being reported as lost after they suspend, which left the following `resume()` streaming nothing and never finishing. This happened when a lease renewal sent just before the suspension reached storage after the run had already released its claim, most often with storage whose new connections are slow to open. Evented agent runs on a shared transport, such as Redis or a socket broker, were affected the same way when their worker released the claim. A late renewal is now ignored when the release confirmed the run still held its claim, and `resume()` streams to its finish. A renewal rejected because another execution took the run over still stops the run. Fixes [#30206](https://github.com/mastra-ai/mastra/issues/30206).
