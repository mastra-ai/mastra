---
'@mastra/braintrust': patch
---

Fixed the Braintrust exporter's `flush()` and `shutdown()` so they wait for Braintrust's background logger to send queued spans, scores, and abort updates instead of returning early.
