---
'@mastra/core': patch
'@mastra/mcp': patch
---

Failed MCP tool calls no longer put server error text in tracked exceptions, because that text can repeat submitted arguments. Tracked exceptions now record a fixed classification such as `MCP_CLIENT_TOOL_PROTOCOL_ERROR_32602`. Callers and the model still get the full error.

Tool logs and tracked exceptions also no longer include the current span, which held the user's input and the observability config.
