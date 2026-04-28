---
'@mastra/hono': patch
'@mastra/server': patch
---

Refactored Hono adapter's `registerCustomApiRoutes()` to use the shared `buildCustomRouteHandler()` from the base class instead of duplicating route/handler resolution logic. Added `forwardCustomRouteRequest()` to the base class for adapters that already have a raw `Request` object (avoiding unnecessary request reconstruction).
