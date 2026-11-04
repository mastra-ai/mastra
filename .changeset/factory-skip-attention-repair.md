---
'@mastra/factory': patch
---

Factory starts faster on large databases. Startup no longer runs a one-off cleanup of old automation decisions, which looked up each affected card one at a time and could hold the server past its health check.
