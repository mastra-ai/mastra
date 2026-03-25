---
'@mastra/mcp': minor
'@mastra/core': minor
---

**Added** `RequestContext.registerDispose` and `RequestContext.dispose` so you can release per-request resources after an agent run.

**Improved** the outer agent stream so it calls `requestContext.dispose()` when streaming completes normally, on errors, tripwire, or client cancellation. Skipped while a run is suspended (for example tool approval) and skipped for inner structured-output LLM steps.

**Usage**

```typescript
const ctx = new RequestContext();
ctx.registerDispose(async () => {
  await someClient.close();
});
// After the agent stream finishes, handlers run automatically.
```

**Added** `MCPClient.registerDisconnectOnRunEnd(requestContext)` so dynamic `Agent` `tools` factories can schedule `disconnect()` when the request-scoped agent run finishes, without closing the MCP session before tools execute.

Example:

```typescript
tools: async ({ requestContext }) => {
  const mcp = new MCPClient({ id: `profile:${userId}`, servers: { ... } });
  mcp.registerDisconnectOnRunEnd(requestContext);
  return { ...(await mcp.listTools()), weatherTool };
};
```
