---
'@mastra/factory': minor
---

Added a `tools` option to `MastraFactory`, so every session on a Factory can use your own tools, including MCP tools and your Mastra Connect connections. For example, give sessions in web chat, Slack and on work items the tools of your project's Linear connection:

```ts
import { tools as connectTools } from '@mastra/connect';
import { MastraFactory } from '@mastra/factory';

const factory = new MastraFactory({
  // ...
  tools: connectTools({ providers: ['linear'] }),
});
```

Pass an MCP server's tools (`await mcpClient.listTools()`) the same way, or a function that picks tools for each run from its request context. All sessions and users on the Factory share the credentials built into these tools. A tool named like one Factory already gives the session is skipped with a warning, so Factory's own tools keep working. Factory no longer loads MCP servers from the host's `mcp.json` files, so the `tools` option is the one place a Factory's MCP tools come from.
