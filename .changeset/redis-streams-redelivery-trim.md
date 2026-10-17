---
'@mastra/redis-streams': patch
---

Fixed redelivered events growing Redis streams past `maxStreamLength`. Nack and in-flight-timeout redeliveries now trim the stream the same way `publish()` does.
