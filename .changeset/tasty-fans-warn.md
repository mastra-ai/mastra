---
'@mastra/deployer': patch
---

Fixed `apiPrefix` server option not being applied to the underlying Hono server instance. Routes, welcome page, Swagger UI, and studio HTML handler now all respect the configured `apiPrefix` instead of hardcoding `/api`.
