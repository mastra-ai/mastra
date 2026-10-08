---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/nestjs': patch
---

Hono and NestJS custom routes now return 403 when a mapped caller's request names different resource ids across the path, query and body while `authorizeUserResource` is set.
