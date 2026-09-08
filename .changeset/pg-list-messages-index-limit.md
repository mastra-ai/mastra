---
'@mastra/pg': patch
'@mastra/core': patch
---

Last-N memory reads on PostgresStore use the thread/createdAt index instead of scanning every message in the thread. The agent MessageHistory processor skips the unused total count. Studio and other callers that still need `total` get it from a skinny `COUNT(*)` in the same round-trip.
