---
'@mastra/mcp': patch
---

Fixed `Cannot find package '@modelcontextprotocol/sdk'` when importing `@mastra/mcp` in projects that skip automatic peer installation (e.g. npm with `--legacy-peer-deps`), by declaring the MCP SDK v1 peer required by `@modelcontextprotocol/ext-apps` as a direct dependency.
