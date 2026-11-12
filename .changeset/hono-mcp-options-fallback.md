---
'@mastra/hono': patch
---

Fixed `server.mcpOptions` from your `Mastra` config being ignored when you create the Hono adapter yourself (`new MastraServer({ app, mastra })`) without passing `mcpOptions`. A `setRequestAuth` hook set in the config now controls what MCP tools see as `context.mcp.extra.authInfo`, as it already did under `mastra dev` and `mastra build`. Options passed to the adapter still take precedence.
