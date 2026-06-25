---
'@mastra/mcp': minor
---

Fixed MCP tool execution failures being recorded as successes.

Per the MCP spec, a server reports a tool execution failure in-band by returning a result with `isError: true` and the error text in its content. `MCPClient` previously ignored this flag, so failed tool calls were traced and persisted as successes, error-handling machinery (error chunks, retry policies, Studio error states) never engaged, and for tools with an `outputSchema` the error text was dropped entirely — so neither the model nor the user saw why the call failed.

Now `isError: true` results are surfaced on the failed-tool-call path: the tool throws with the server's error text, so spans, stream chunks, scorers, and persisted messages reflect the failure and the model can self-correct.

You can opt back into the previous behavior per server with `onToolError: 'return'`, which resolves with the raw result instead of throwing:

```typescript
const mcp = new MCPClient({
  servers: {
    weather: {
      url: new URL('https://example.com/mcp'),
      onToolError: 'return', // default is 'throw'
    },
  },
});
```
