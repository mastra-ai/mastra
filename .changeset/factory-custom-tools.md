---
'@mastra/factory': minor
---

Organization admins can now give their Factory sessions Mastra Connect tools. With Platform credentials and `MASTRA_PROJECT_ID`, which Platform deploys already have, an admin turns providers on in **Settings → Tools**, and sessions in web chat, Slack and on work items in that organization can use them. Turn on Linear, and a Slack thread can ask about its issues. Nothing is on by default.

Sessions run these tools without asking for approval, so only turn on providers whose actions sessions may take. Delete and archive tools are always left out. The connections belong to the Platform project and every organization shares them, but each organization chooses its own providers.

Added a `tools` option to choose session tools yourself, such as an MCP server's tools or a fixed Connect selection. It replaces the default, and `tools: {}` turns it off:

```ts
import { tools as connectTools } from '@mastra/connect';
import { MastraFactory } from '@mastra/factory';

const factory = new MastraFactory({
  // ...
  tools: connectTools({ providers: ['linear'] }),
});
```

A tool named like one Factory already gives the session is skipped with a warning, so Factory's own tools keep working.

**Migration:** Factory doesn't load MCP servers from the host's `mcp.json` files, and warns at startup when `~/.mastracode/mcp.json` exists. Pass those MCP tools through `tools` instead, for example `tools: await mcp.listTools()` with an `MCPClient`.
