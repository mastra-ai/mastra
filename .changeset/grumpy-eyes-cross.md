---
'@mastra/server': minor
---

Added a framework guarantee that user-registered server middleware can no longer block routes declared public via `createPublicRoute()` or `requiresAuth: false`.

**Why**

Previously, middleware registered through `serverMiddleware` or `server.middleware` ran before the framework's per-route auth check and could return a 401 for any request, including the Studio sign-in flow's own public auth endpoints. This made it possible for a user middleware to lock users out of their own login UI.

**What changed**

`MastraServer` now exposes a `getFrameworkPublicMatcher()` API that builds a matcher from the route metadata itself (both built-in `SERVER_ROUTES` and custom routes). Adapters use this matcher to short-circuit user middleware for framework-public routes. The matcher is built from route metadata, so any route declared public with `requiresAuth: false` is automatically covered.
