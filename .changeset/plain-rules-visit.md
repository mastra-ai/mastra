---
'@mastra/server': minor
---

Added `authorizeRoute`, `checkRouteRBAC` and `dispatchRoute` to `@mastra/server/server-adapter`. Custom server adapters can now run the same RBAC and fine-grained authorization checks as the built-in adapters with one call, and server code can invoke a built-in route in-process with the same authorization, validation and error responses as an HTTP request to that route.

`dispatchRoute` reuses the user already authenticated into the request context and applies your `server.auth` `rules`, `authorize` and `authorizeUser` hooks to the dispatched route's own path, then schema validation, RBAC, fine-grained authorization and the route handler. Path params always take precedence over same-named body or query fields.

```ts
import { SERVER_ROUTES, dispatchRoute } from '@mastra/server/server-adapter';

const route = SERVER_ROUTES.find(r => r.method === 'POST' && r.path === '/tools/:toolId/execute')!;
const outcome = await dispatchRoute(
  route,
  { pathParams: { toolId: 'weather' }, body: { data: { city: 'Paris' } } },
  { mastra, requestContext, abortSignal, request },
);
if (!outcome.ok) console.log(outcome.status, outcome.body); // e.g. 403 { error: 'Forbidden', ... }
```

The built-in adapters now call the shared `checkRouteRBAC` for route permission checks. If you subclass a built-in adapter and override `checkRoutePermission` or `getEffectiveRBACProvider`, those overrides are no longer consulted for route permissions.
