---
'@mastra/connect': minor
---

Export the platform client (`resolveClient`, `listProjectConnections`, `proxyRequest`, and the `ResolvedClient` and `ProxyRequestOptions` types) so you can build your own Knowledge importers on top of your Connect connections.

```ts
import { listProjectConnections, proxyRequest, resolveClient } from '@mastra/connect';

const client = resolveClient();
const [connection] = await listProjectConnections(client, projectId);
const pages = await proxyRequest(client, connection.id, { method: 'POST', path: 'v1/search', body: {} });
```
