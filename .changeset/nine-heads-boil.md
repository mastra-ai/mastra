---
'@mastra/core': patch
---

Added the tool call ID to tool execution spans (`TOOL_CALL` and `MCP_TOOL_CALL`) so observability exporters can correlate a tool call with its result.
