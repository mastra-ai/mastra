---
'@mastra/braintrust': patch
---

Fixed tool calls showing as `unknown_tool` in the Braintrust Messages tab. Tool spans (`TOOL_CALL` and `MCP_TOOL_CALL`) are now converted to OpenAI chat messages, so Braintrust shows the real tool name and pairs the call with its result.
