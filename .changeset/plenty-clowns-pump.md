---
'@mastra/server': patch
---

Added a feedback flag to the observability storage capabilities reported by GET /observability/capabilities and GET /system/packages, so clients can check feedback support before calling the feedback endpoints. Feedback routes now return a 501 status instead of a server error when the configured observability store does not support feedback (for example LibSQL), which also removes the noisy error log Studio triggered when probing feedback on such stores.
