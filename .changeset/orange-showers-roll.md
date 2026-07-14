---
'@mastra/braintrust': patch
---

Fixed tool calls showing as `unknown_tool` in the Braintrust Messages tab. Tool spans (`TOOL_CALL`, `MCP_TOOL_CALL`, and `PROVIDER_TOOL_CALL`) are now converted to OpenAI chat messages with the real tool name and paired result, so Braintrust renders them correctly.
