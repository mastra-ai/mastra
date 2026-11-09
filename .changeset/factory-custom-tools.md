---
'@mastra/factory': minor
---

Factory sessions can now use your Mastra Connect tools. With Platform credentials and `MASTRA_PROJECT_ID`, which Platform deploys already have, sessions in web chat, Slack and on work items get the tools of every connection attached to your Platform project. Attach Linear on the project's **Connect** page in Mastra Platform, and a Slack thread can ask about its issues. **Settings → Tools** shows which connections sessions get.

Sessions run these tools without asking while automatic approval is on, so only attach accounts whose actions sessions may take. When a person turns approval off, the tools follow the `mcp` permission category, except in Slack with `toolDisplay: 'text'`, where every tool call is approved automatically. Tools with `delete` or `archive` in their name are left out, and so are GitHub and GitLab tools, because Factory's own source-control tools enforce repository scope and self-review. Your organization's other connections stay out until you attach them to the project. If your project already has connections attached, sessions get their tools as soon as you upgrade.

Added a `tools` option to choose session tools yourself, such as an MCP server's tools or a fixed Connect selection. It replaces the default, and `tools: {}` turns it off. Factory doesn't filter the tools you pass, so the example below includes Linear's delete tools unless you narrow it with Connect's `allowTools` or `disallowTools`:

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
