---
'@mastra/factory': minor
---

Factory sessions can now use your Mastra Connect tools. With Platform credentials and `MASTRA_PROJECT_ID`, which Platform deploys already have, sessions in web chat, Slack and on work items get the tools of every connection attached to your Platform project. Attach Linear on the project's **Connect** page in Mastra Platform, and a Slack thread can ask about its issues. **Settings → Tools** shows which connections sessions get.

Sessions run these tools without asking for approval, so only attach accounts whose actions sessions may take. Delete and archive tools are always left out. Your organization's other connections stay out until you attach them to the project. If your project already has connections attached, sessions get their tools as soon as you upgrade.

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
