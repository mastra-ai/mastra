---
'@mastra/core': minor
---

Added the `MCP_SERVER_REQUEST` span type, `MCPServerRequestAttributes`, and `EntityType.MCP_SERVER` for requests served by a Mastra `MCPServer`. Added a `skipToolSpan` tool execution option so a caller that already owns a span can run a tool without an extra `TOOL_CALL` span:

```ts
await tool.execute(args, {
  tracingContext: { currentSpan: requestSpan },
  skipToolSpan: true,
});
```

See https://github.com/mastra-ai/mastra/issues/23921
