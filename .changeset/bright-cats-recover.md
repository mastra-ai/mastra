---
'@mastra/server': patch
---

Return HTTP 409 for durable-agent recovery requests whose run is no longer active instead of treating snapshot state as an HTTP status.
