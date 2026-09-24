---
'@mastra/server': patch
---

Added a feedback flag to the observability storage capabilities reported by GET /observability/capabilities and GET /system/packages, so clients can check feedback support before calling the feedback endpoints. Observability routes backed by an optional storage API (feedback, metrics, logs, scores) now return a 501 status instead of a server error when the configured store does not implement it (for example LibSQL and feedback), which also removes the noisy error log Studio triggered when probing feedback on such stores.
