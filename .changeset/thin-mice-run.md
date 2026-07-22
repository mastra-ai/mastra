---
'@mastra/factory': minor
'@mastra/core': patch
---

Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes.
