---
'@mastra/server': minor
---

Added `invokeRoute` to `@mastra/server/server-adapter`. It runs a server route in-process as the calling user, with the same permission, fine-grained authorization and schema checks the HTTP route applies, and returns the route's status and body. Use it to expose a route through another channel, such as an MCP tool, without the two drifting apart.

```ts
import { invokeRoute } from '@mastra/server/server-adapter';
import { GET_METRIC_AGGREGATE } from '@mastra/server/handlers/observability';

const { status, body } = await invokeRoute(GET_METRIC_AGGREGATE, {
  mastra,
  requestContext, // already carries the authenticated caller
  body: { name: ['mastra_agent_duration_ms'], aggregation: 'count' },
});
```

MCP tools served over HTTP now also see the caller that Mastra server auth resolved (user, permissions, roles, resource and organization), the same as Mastra routes do.
