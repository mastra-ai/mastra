---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/koa': patch
---

Fixed `server.mcpOptions` from your `Mastra` config being ignored when you don't pass `mcpOptions` to the adapter (or to `MastraModule.register` in NestJS). A `setRequestAuth` hook set in the config now controls what MCP tools see as `context.mcp.extra.authInfo`, instead of the default bridge exposing the caller's bearer token and full user. Options passed to the adapter still take precedence.
