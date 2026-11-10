---
'@mastra/server': minor
---

Added `authorizeRoute`, `checkRouteRBAC` and `dispatchRoute` to `@mastra/server/server-adapter`. Custom server adapters can now run the same RBAC and fine-grained authorization checks as the built-in adapters with one call, and server code can invoke a built-in route in-process with the same authorization, validation and error responses as an HTTP request to that route.

`dispatchRoute` reuses the user already authenticated into the request context and applies your `server.auth` `rules`, `authorize` and `authorizeUser` hooks to the dispatched route's own path, then schema validation, RBAC, fine-grained authorization and the route handler. It never allows more than the HTTP request would: with auth configured it needs an authenticated user unless the path is declared `public`, it rejects path params a URL could not carry (empty, missing, `.` or `..`), and path params always take precedence over same-named body or query fields.

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

Rules are read against the path the route is served under, taken from the server adapter created for the `Mastra` instance. If you create more than one adapter for the same instance, set `routePrefix` in the context to the prefix of the one whose paths apply. Adapters that don't extend `MastraServer` can call the new `registerDispatchAdapter` to say where they serve routes.

The built-in adapters still run route permission checks through `checkRoutePermission`, so a subclass that overrides it keeps working, and the override now also applies to routes run with `dispatchRoute`.
