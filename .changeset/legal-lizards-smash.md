---
'@mastra/mcp': patch
---

Fixed flaky MCP server tests that used hardcoded random port ranges by binding to OS-assigned ephemeral ports instead.
