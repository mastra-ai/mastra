---
'@mastra/deployer': patch
---

Fixed `apiPrefix` server option not being passed to the underlying Hono server instance, causing routes to always use the default `/api` prefix regardless of configuration.
