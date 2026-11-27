---
'@mastra/client-js': patch
---

Fix A2A cancelTask to reject HTTP-200 JSON-RPC error envelopes while preserving successful legacy response envelopes.
