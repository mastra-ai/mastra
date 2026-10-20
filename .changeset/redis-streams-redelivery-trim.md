---
'@mastra/redis-streams': patch
---

Fixed redelivered events growing Redis streams past `maxStreamLength`. Nack, in-flight-timeout, and fan-out replay redeliveries now trim the stream the same way `publish()` does.
