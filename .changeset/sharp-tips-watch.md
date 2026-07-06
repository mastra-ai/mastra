---
'@mastra/mcp': patch
---

Fixed MCP client tools missing output schemas in tool listings. Fixes #18850.

MCP tools that declare an `outputSchema` now expose that schema on the Mastra tool wrapper, so Studio and other consumers can document expected tool outputs.

Mastra does not re-validate MCP tool results. The MCP SDK still validates `structuredContent` via AJV. This keeps full `CallToolResult` envelopes and extra fields intact while making output shapes visible again.

```typescript
const tools = await mcp.listTools();
const outputSchema = tools['weather_getForecast'].outputSchema?.['~standard'].jsonSchema.output({
  target: 'draft-07',
});
```
