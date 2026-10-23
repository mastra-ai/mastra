---
'@mastra/adonisjs': minor
---

Added `@mastra/adonisjs`, an official server adapter that serves the Mastra HTTP API from an AdonisJS v6 app.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import { MastraServer } from '@mastra/adonisjs'
import { mastra } from '#mastra/index'

await new MastraServer({ app: router, mastra }).init()
app.terminating(() => mastra.shutdown())
```

Mastra routes are registered as real AdonisJS routes under the configured prefix (`/api` by default), with Mastra auth, RBAC, FGA, body limits, streaming, and MCP transports. Use `routeMiddleware` to apply AdonisJS middleware to every Mastra route, `getHttpContext(requestContext)` to reach the AdonisJS `HttpContext` from tools, and `createAuthMiddleware()` to protect your own routes with Mastra auth.
