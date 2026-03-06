---
'@mastra/server': patch
'@mastra/server-hono': patch
---

fix(server): OpenAPI spec now correctly represents custom route paths and restores root endpoint

- Custom routes registered via `registerApiRoute` are served at the root path (e.g. `/health`), not under `/api`. The OpenAPI spec now adds a per-path `servers: [{url: "/"}]` override on custom route path items so that clients resolve them correctly instead of incorrectly prepending `/api`.
- The OpenAPI spec is now served at both `/openapi.json` (root) and `/api/openapi.json` for backwards compatibility with pre-V1 consumers that expect the root path.
