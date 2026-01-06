---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Added shared `normalizeQueryParams` helper for consistent query parameter handling across all server adapters.

- Added `normalizeQueryParams` function to `@mastra/server` that normalizes query params from various HTTP framework formats to a consistent `Record<string, string | string[]>` structure
- Updated all server adapters (Express, Hono, Fastify, Koa) to use the shared helper
- Handles both single string values and arrays for repeated query params (e.g., `?tag=a&tag=b`)
- Filters out non-string values that some frameworks may include
