---
'@mastra/client-js': patch
---

Reject `subscribeToThread().processDataStream()` with the original error when a client-tool continuation fails, instead of logging it and resolving as if the run finished. Signal runtime options are still cleared on failure.
