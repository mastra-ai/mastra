---
'@mastra/hono': patch
'@mastra/nestjs': patch
---

Run the server's `authorizeUserResource` policy on every route. NestJS now checks it in its route handler and custom-route chain (custom routes read JSON bodies). Hono custom routes now read the request body for this check even when FGA isn't configured. That read stops at `bodyLimitOptions.maxSize`; a larger body is not read for the check, so a resource named in it is never approved (and an FGA check that needs a resource id from it is denied).
