---
'@mastra/server': minor
---

Added spanQueryTextSearch and traceQueryTextSearch capabilities and query request forwarding. Text-search requests now return an unsupported error when the configured store does not advertise the corresponding capability.
