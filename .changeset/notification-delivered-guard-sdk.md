---
'@mastra/code-sdk': patch
---

Forward `markNotificationDelivered()` through the lazy notifications storage so the dispatcher's guarded delivered write reaches the configured adapter.
