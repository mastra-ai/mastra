---
'@mastra/deployer': patch
---

Fixed user-registered middleware (`serverMiddleware` and `server.middleware`) being able to return a 401 for framework-public routes such as the Studio sign-in endpoints.

The deployer now wraps every user middleware with `skipIfFrameworkPublic` from `@mastra/hono`, so requests to routes declared public via `createPublicRoute()` / `requiresAuth: false` always reach their handler.
