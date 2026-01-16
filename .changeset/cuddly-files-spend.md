---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Fixed inconsistent query parameter handling across server adapters.

**What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). Added internal helper `normalizeQueryParams` and `ParsedRequestParams` type to `@mastra/server` for adapter implementations.

**Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

**User impact:** None for typical usage - HTTP endpoints and client SDK behavior are unchanged. If you extend server adapter classes and override `getParams` or `parseQueryParams`, update your implementation to use `Record<string, string | string[]>` for query parameters.
