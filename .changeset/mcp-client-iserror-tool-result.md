---
'@mastra/mcp': minor
---

Fixed MCP tool execution failures being recorded as successes.

A failing MCP tool used to look like it succeeded. The call was traced and saved as a success, and error handling like retries and Studio error states never ran. For tools with an `outputSchema`, the error message was thrown away, so neither the model nor the user saw why the call failed.

This happened because the server reports the failure inside a normal result (with an `isError` flag), and `MCPClient` did not check that flag.

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
