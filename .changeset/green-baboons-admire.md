---
'@mastra/nestjs': patch
---

Fixed `@mastra/nestjs` to run the same auth pipeline as the other server adapters. Cookie-based sessions now authenticate, custom routes registered with `registerApiRoute()` are served (honoring `requiresAuth`), and `mapUserToResourceId` is applied to the request context. Fixes #24964.
