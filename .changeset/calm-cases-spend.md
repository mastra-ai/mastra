---
'@mastra/client-js': minor
---

Added `transports` to MCP server info responses so consumers can tell which endpoints a server serves. MCP v2 servers report `['streamable-http']` only; MCP 1.x servers also report `'sse'`. Servers that predate the field omit it, so treat absence as 1.x.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const { servers } = await client.getMcpServers();

for (const server of servers) {
  const hasSse = server.transports?.includes('sse') ?? true;
  const path = hasSse ? 'sse' : 'mcp';
  console.log(`${server.name}: http://localhost:4111/api/mcp/${server.id}/${path}`);
}
```
