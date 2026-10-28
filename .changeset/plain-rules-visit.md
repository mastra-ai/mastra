---
'@mastra/server': minor
---

Added `authorizeRoute`, `checkRouteRBAC` and `dispatchRoute` to `@mastra/server/server-adapter`. Custom server adapters can now run the same RBAC and fine-grained authorization checks as the built-in adapters with one call, and server code can invoke a built-in route in-process with the same validation, authorization and error responses as an HTTP request.

```ts
import { SERVER_ROUTES, dispatchRoute } from '@mastra/server/server-adapter';

const route = SERVER_ROUTES.find(r => r.method === 'POST' && r.path === '/tools/:toolId/execute')!;
const outcome = await dispatchRoute(
  route,
  { pathParams: { toolId: 'weather' }, body: { data: { city: 'Paris' } } },
  { mastra, requestContext, abortSignal },
);
if (!outcome.ok) console.log(outcome.status, outcome.body); // e.g. 403 { error: 'Forbidden', ... }
```
