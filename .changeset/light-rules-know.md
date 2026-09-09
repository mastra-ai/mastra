---
'@mastra/mcp': minor
---

Added `MastraApiMCPServer` to expose supported Mastra server operations from the `mastra api` CLI as MCP tools. The server reads the target API's input schemas, forwards authentication, and marks generic execution as potentially destructive. Factory commands aren't included.

```typescript
import { MastraApiMCPServer } from '@mastra/mcp';

const operations = await MastraApiMCPServer.create({
  url: 'https://my-mastra-server.example.com',
  headers: { Authorization: `Bearer ${process.env.MASTRA_API_TOKEN}` },
});
```
