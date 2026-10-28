---
'@mastra/factory': minor
---

Added a `tools` option to `MastraFactory`, so you can give every session on a Factory your own tools, including tools from MCP servers. Connect an `MCPClient` with the credentials the tools need, then pass its tools in. All sessions and users on the Factory share them.

```ts
import { MCPClient } from '@mastra/mcp';
import { MastraFactory } from '@mastra/factory';

const mcp = new MCPClient({
  servers: {
    tickets: {
      url: new URL('https://tickets.example.com/mcp'),
      requestInit: { headers: { Authorization: `Bearer ${process.env.TICKETS_TOKEN}` } },
    },
  },
});

const factory = new MastraFactory({
  // ...
  tools: await mcp.listTools(),
});
```

Pass a function instead to choose tools for each run from its request context. A tool whose name matches one of Factory's own tools fails the run with an error naming both, rather than replacing it. Factory no longer loads MCP servers from the host's `mcp.json` files, so the `tools` option is the one place a Factory's MCP tools come from.
