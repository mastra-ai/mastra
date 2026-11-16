---
'@mastra/core': patch
---

Fixed durable agent runs being reported as lost after they suspend, which left the following `resume()` streaming nothing and never finishing. This happened when a lease renewal sent just before the suspension reached storage after the run had already released its claim, most often with storage whose new connections are slow to open. The late renewal is now ignored, and `resume()` streams to its finish. Fixes [#30206](https://github.com/mastra-ai/mastra/issues/30206).
