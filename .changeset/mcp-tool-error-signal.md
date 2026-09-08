---
'@mastra/mcp': patch
---

Preserve MCP tool failure signals for non-LLM consumers. With `onToolError: 'return'`, an `isError` tool result now returns the full `CallToolResult` envelope (`isError`, `content`, `structuredContent`) instead of collapsing to bare `structuredContent`, so MCP App UI hosts can always detect failure regardless of whether the tool has an output schema. With `onToolError: 'throw'`, the thrown `MastraError` now includes the server's `structuredContent` (JSON-serialized) under `details.structuredContent`, so callers that catch the error can recover structured error data.
