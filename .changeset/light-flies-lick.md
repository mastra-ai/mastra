---
'@mastra/core': patch
'@mastra/mcp': patch
---

Add support for `instructions` field in MCPServer

Implements the official MCP specification's `instructions` field, which allows MCP servers to provide system-wide prompts that are automatically sent to clients during initialization. This eliminates the need for per-project configuration files (like AGENTS.md) by centralizing the system prompt in the server definition.

**What's New:**
- Added `instructions` optional field to `MCPServerConfig` type
- Instructions are passed to the underlying MCP SDK Server during initialization
- Instructions are sent to clients in the `InitializeResult` response
- Fully compatible with all MCP clients (Cursor, Windsurf, Claude Desktop, etc.)

**Example Usage:**
```typescript
const server = new MCPServer({
  name: "GitHub MCP Server",
  version: "1.0.0",
  instructions: "Use the available tools to help users manage GitHub repositories, issues, and pull requests. Always search before creating to avoid duplicates.",
  tools: { searchIssues, createIssue, listPRs }
});
```
