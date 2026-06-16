---
'@mastra/mcp': minor
---

Added `MCPClient.listToolsWithErrors()` to return namespaced tools alongside per-server discovery errors.

Example:

```ts
const { tools, errors } = await mcp.listToolsWithErrors();

new Agent({
  name: 'assistant',
  tools,
});

if (Object.keys(errors).length > 0) {
  console.error(errors);
}
```