---
'@mastra/core': patch
---

Fixed an unhandled rejection when a run lost its thread lease and its agent could not abort the run. Background lease-loss callbacks now contain abort failures. Remote abort requests still report failures so transports that support retries can deliver the request again.
