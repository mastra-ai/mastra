---
'@mastra/redis': patch
---

Improved durable agent streaming latency when Redis is remote (issue #22477). Recording a stream event in the cache used to take four sequential Redis commands (INCR, EXPIRE, RPUSH, EXPIRE); it now runs as a single atomic Lua script, so each streamed chunk costs one Redis round-trip instead of four. Added an optional `evalScript` adapter hook for custom client libraries; the built-in ioredis, node-redis, and Upstash presets support it out of the box, and the cache falls back to the previous multi-command path if the client has no `evalScript` or Redis Cluster rejects the multi-key script (CROSSSLOT).
