---
'@mastra/server': minor
'@mastra/deployer': patch
---

Added support for including custom API routes in the generated OpenAPI documentation. Custom routes registered via `registerApiRoute()` now appear in the OpenAPI spec alongside built-in Mastra routes.

Also fixed swagger-ui to use the correct OpenAPI endpoint URL (/api/openapi.json).
