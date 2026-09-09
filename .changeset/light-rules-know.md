---
'@mastra/mcp': minor
---

Added `MastraApiMCPServer` to expose supported Mastra server operations from the `mastra api` CLI as MCP tools. The server reads the target API's input schemas and forwards authentication. All non-GET operations, including agent, workflow, experiment, and tool execution, are marked as potentially destructive so MCP clients can ask for confirmation. Factory commands aren't included.

```typescript
import { MastraApiMCPServer } from '@mastra/mcp';

const operations = await MastraApiMCPServer.create({
  url: 'https://my-mastra-server.example.com',
  headers: { Authorization: `Bearer ${process.env.MASTRA_API_TOKEN}` },
});
```
