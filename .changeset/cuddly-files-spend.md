---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Fixed inconsistent query parameter handling across server adapters.

**What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). This is an internal improvement with no changes to external APIs.

**Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

**User impact:** None - this change is transparent. Your existing code will continue to work as before.
