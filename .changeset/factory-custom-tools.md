---
'@mastra/factory': minor
---

Factory sessions now get your Mastra Connect tools automatically. With Platform credentials and `MASTRA_PROJECT_ID`, which Platform deploys already have, every session in web chat, Slack and on work items can use the tools of each provider connected in your Platform project. Connect Linear, and a Slack thread can ask about its issues. Delete and archive tools are left out, because sessions approve tools automatically by default. Every user and organization on the Factory shares these connections.

Added a `tools` option to choose session tools yourself, such as an MCP server's tools or a narrower Connect selection. It replaces the default, and `tools: {}` turns it off:

```ts
import { tools as connectTools } from '@mastra/connect';
import { MastraFactory } from '@mastra/factory';

const factory = new MastraFactory({
  // ...
  tools: connectTools({ providers: ['linear'] }),
});
```

A tool named like one Factory already gives the session is skipped with a warning, so Factory's own tools keep working. Factory no longer loads MCP servers from the host's `mcp.json` files, so `tools` is the one place a Factory's MCP tools come from.
