---
'@mastra/server': patch
---

Fixed agent-controller stream errors losing the provider's `statusCode`, `code` and body `reason` when flattened for the wire, so a live error notice classifies like a reloaded one. Requires @mastra/core 1.79.0 or newer.
