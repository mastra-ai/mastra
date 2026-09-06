---
'@mastra/valkey': patch
---

Improved durable agent streaming latency when Valkey is remote (issue #22477). Recording a stream event in the cache now runs as a single atomic Lua script instead of four sequential commands, so each streamed chunk costs one round-trip.
