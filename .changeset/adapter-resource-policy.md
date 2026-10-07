---
'@mastra/nestjs': patch
'@mastra/hono': patch
---

The server's `authorizeUserResource` check now runs on NestJS built-in and custom API routes. Hono custom routes now read the request body for the check even without FGA, so a `resourceId` sent in the body is checked.
