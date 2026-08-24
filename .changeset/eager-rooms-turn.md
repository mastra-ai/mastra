---
'@mastra/mcp': patch
---

Preserve structured HTTP status and transport codes in aggregate MCP discovery errors while retaining legacy string errors.

```typescript
const { errorDetails } = await mcp.listToolsWithErrors()
if (errorDetails.weather?.httpStatus === 503) {
  // Apply a transient-failure policy without parsing the legacy error string.
}
```
