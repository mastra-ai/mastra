---
'@mastra/koa': patch
---

Fixed `TypeError: Cannot read properties of undefined (reading 'length')` thrown during `MastraServer.init()` when a subclass forwards a non-Koa app-like object (for example a `koa-router` instance, a mounted sub-app, or a custom wrapper) to `super.registerRoute(app, route, opts)`. The dispatcher-reuse optimization introduced in 1.5.0 now requires the target to expose an `app.middleware` array; otherwise it falls back to registering a fresh dispatcher per route via `app.use`, matching the pre-1.5.0 per-route behavior.

**Example (subclass that previously crashed):**

```ts
import { MastraServer } from '@mastra/koa';
import Router from 'koa-router';

class CustomKoaMastraServer extends MastraServer {
  private router = new Router();

  async registerCustomApiRoutes() {
    const routes = this.mastra.getServer()?.apiRoutes ?? [];
    for (const route of routes) {
      // The router has no `middleware` array — this used to throw at init.
      await super.registerRoute(this.router as any, route, { prefix: this.prefix });
    }
    this.app.use(this.router.routes());
  }
}
```
