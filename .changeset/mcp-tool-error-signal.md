---
'@mastra/mcp': patch
---

Preserve MCP tool failure signals for non-LLM consumers.

With `onToolError: 'return'`, object/array structured errors keep their existing bare shape and carry a non-enumerable error flag. Scalar/null structured errors now return the full `CallToolResult` envelope instead of the bare value. Consumers of these failed scalar/null results must read `result.structuredContent` instead of treating the result as a primitive. Successful return shapes are unchanged.

Content-only errors continue to return the full envelope. All client-returned errors now carry the hidden flag, so `getMcpCallToolIsError()` detects both bare structured errors and error envelopes. It reads client metadata, not a user-data field named `isError`. Raw or deserialized MCP envelopes instead expose `result.isError` directly.

With `onToolError: 'throw'`, the thrown `MastraError` includes the server's `structuredContent` (JSON-serialized) under `details.structuredContent`.

```ts
import { getMcpCallToolIsError, getMcpCallToolContent } from '@mastra/mcp';

const result = await tool.execute(input);
if (getMcpCallToolIsError(result)) {
  const content = getMcpCallToolContent(result);
  // Object/array structured errors expose fields directly.
  // Scalar/null errors preserve their value in result.structuredContent.
}
```
