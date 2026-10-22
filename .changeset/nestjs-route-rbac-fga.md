---
'@mastra/nestjs': patch
---

Fixed the NestJS adapter skipping per-route authorization. Mastra routes served through `MastraModule` now enforce RBAC permissions and FGA checks like the other adapters, so a user without the required permission gets a 403 instead of the route's response.

Studio requests (`x-mastra-client-type: studio`) now authenticate against `studio.auth` when it is configured, instead of only `server.auth`.

The adapter now logs a startup warning when `server.middleware` or `setServerMiddleware()` is configured, since those Hono middleware handlers can't run on NestJS.
