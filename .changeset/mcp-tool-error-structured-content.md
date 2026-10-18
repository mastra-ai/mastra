---
'@mastra/mcp': minor
---

Fixed MCP tool errors losing information when the server returns `structuredContent` with `isError: true`.

- With `onToolError: 'return'`, the tool now resolves with the full `CallToolResult` (`isError`, `content`, `structuredContent`) instead of only `structuredContent`, so callers and the model can tell the call failed.

  **Migration:** if you use `onToolError: 'return'` and read the bare `structuredContent` from a failed call, read `result.structuredContent` and check `result.isError` instead.
- With `onToolError: 'throw'` (the default), the thrown `MastraError` now carries the structured reason as a JSON string in `details.structuredContent`.

```ts
try {
  await tools.recipes_submitRecipe.execute({ title: 'Soup' })
} catch (error) {
  const reason = JSON.parse(error.details.structuredContent)
  // { code: 'VALIDATION_FAILED', validationResults: [...] }
}
```
