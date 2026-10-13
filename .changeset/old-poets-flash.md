---
'@mastra/mcp': patch
---

Fixed `MCPClient` sending malformed tool input schemas to model providers. One MCP tool with a broken schema (for example a `required` list placed inside `properties`) used to make strict providers such as OpenAI reject every request, even ones that didn't use that tool.

- Tools with a malformed input schema, or one over the nesting/size limit, are now skipped with a warning naming the server, tool, and problem. The server's other tools keep working.
- `toolsFromDefinitions` skips such cached definitions; `toolFromDefinition` throws `MCP_CLIENT_INVALID_TOOL_INPUT_SCHEMA` for them.

Fixes #23731.
