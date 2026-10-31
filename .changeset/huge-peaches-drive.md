---
'@mastra/mcp': patch
---

Fixed `MCPServer` rejecting calls to tools it had just listed when an FGA provider is configured. Each call was checked a second time against the standalone tool (`tool:<toolName>`) rather than the server's tool resource or its `fga` mapping, so a policy that granted only the MCP tool denied every call. Calls are now authorized once, against the same resource and permission `tools/list` uses. Fixes #28787.
