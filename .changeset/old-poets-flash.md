---
'@mastra/mcp': patch
---

Fixed MCPClient sending malformed tool input schemas to model providers. A single MCP tool with a broken schema (for example a `required` list placed inside `properties`) used to make strict providers such as OpenAI reject every request, even ones that didn't use that tool. Such tools are now skipped with a warning naming the server, tool, and problem, and the server's other tools keep working. Loading a single cached tool definition with a broken schema through `toolFromDefinition` now throws `MCP_CLIENT_INVALID_TOOL_INPUT_SCHEMA`; `toolsFromDefinitions` skips it. Fixes #23731.
