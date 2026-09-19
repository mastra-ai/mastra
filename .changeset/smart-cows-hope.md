---
'@mastra/mcp': patch
---

Fixed a memory leak in MCPClient where a failed connection attempt left process exit hooks and SIGTERM/SIGHUP listeners behind. Applications that create an MCP client per request no longer accumulate listeners or hit MaxListenersExceededWarning when a server is unreachable or a connection times out.
