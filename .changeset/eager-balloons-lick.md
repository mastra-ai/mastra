---
'@mastra/server': minor
---

Added `invokeRoute` to `@mastra/server/server-adapter`. It runs a server route in-process as the calling user, with the same checks the HTTP route applies: server auth's `authorize`, `authorizeUser` and `rules` (matched against the route's HTTP path under `apiPrefix`), RBAC permission, fine-grained authorization and schema validation, and returns the route's status and body. Use it to expose a route through another channel, such as an MCP tool, without the two drifting apart.

```ts
import { invokeRoute } from '@mastra/server/server-adapter';
import { GET_METRIC_AGGREGATE } from '@mastra/server/handlers/observability';

const { status, body } = await invokeRoute(GET_METRIC_AGGREGATE, {
  mastra,
  requestContext, // already carries the authenticated caller
  body: { name: ['mastra_agent_duration_ms'], aggregation: 'count' },
});
```

`invokeRoute` only runs routes that answer with JSON and throws for streaming or MCP transport routes. The handler receives the parsed params, `mastra`, `requestContext` and `abortSignal`, but not the HTTP-only `request`, `registeredTools`, `taskStore` or `routePrefix`.

MCP tools served over HTTP now also see the caller that Mastra server auth resolved (user, permissions, roles, resource and organization), the same as Mastra routes do. This also applies when `mcpOptions.setRequestAuth` or your own middleware sets `req.auth`: the hook still decides `authInfo`, and tools additionally receive Mastra's resolved caller in `requestContext`.
