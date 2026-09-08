---
'@mastra/mcp': minor
---

Preserve MCP tool failure signals for non-LLM consumers.

With `onToolError: 'return'`, an `isError` tool result now returns the full `CallToolResult` envelope (`isError`, `content`, `structuredContent`) instead of collapsing to bare `structuredContent`, so MCP App UI hosts can always detect failure regardless of whether the tool has an output schema. With `onToolError: 'throw'`, the thrown `MastraError` now includes the server's `structuredContent` (JSON-serialized) under `details.structuredContent`, so callers that catch the error can recover structured error data.

**Breaking change for `onToolError: 'return'` consumers** that read structured fields directly off an error result. Previously an error result with `structuredContent` returned the bare structured object; it now returns the full envelope. Read structured fields under `.structuredContent` and use `.isError` to detect failure:

```ts
// Before
const result = await tool.execute(...);
if (result.code) { /* ... */ } // structured fields were top-level

// After
const result = await tool.execute(...);
if (result.isError) {
  const { code, validationResults } = result.structuredContent;
  // ...
}
```

The success path is unchanged: non-error structured results still return the bare `structuredContent`.
