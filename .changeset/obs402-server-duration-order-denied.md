---
'@mastra/server': patch
---

Advanced trace queries that order by `durationMs` are rejected with a structured `order_field_not_supported` issue. Duration ordering activates in a following release once the server verifies the storage adapter supports it.
