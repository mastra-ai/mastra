---
'@mastra/factory': patch
---

Move the factory auth module into `@mastra/factory/auth`. The provider-neutral
auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
helpers now live next to the route seam they implement, with factory naming
throughout.
