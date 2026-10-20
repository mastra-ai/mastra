---
'@mastra/connect': minor
---

Export the platform client so you can build your own Knowledge importers and other background services on your Connect connections: `resolveClient`, `listProjectConnections`, `getConnectionContext`, `proxyRequest` and `proxyRequestWithResponse`, with the `ResolvedClient`, `ProxyRequestOptions`, `ProxyResponse` and `ConnectionContext` types. Provider calls go through the guarded connection proxy, so your code never handles provider credentials.

```ts
import { listProjectConnections, proxyRequest, resolveClient } from '@mastra/connect';

const client = resolveClient({ projectId });
const [connection] = await listProjectConnections(client, projectId);
const pages = await proxyRequest(client, connection.id, { method: 'POST', path: 'v1/search', body: {} });
```

A blank project id or connection id now throws `missing_project_id` or `missing_connection_id` before any request is sent. See the Platform client reference for the provider-versus-platform error codes to check before treating an item as deleted.
