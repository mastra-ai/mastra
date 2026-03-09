---
'@mastra/server': patch
'@mastra/server-hono': patch
---

Fixed OpenAPI spec to correctly represent custom route paths

- Custom routes registered via `registerApiRoute` are served at the root path (e.g. `/health`), not under `/api`. The OpenAPI spec now adds a per-path `servers: [{url: "/"}]` override on custom route path items so that clients resolve them correctly instead of incorrectly prepending `/api`.
