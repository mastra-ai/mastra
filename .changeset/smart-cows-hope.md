---
'@mastra/mcp': patch
---

Fixed a resource leak in MCP clients whose connection attempt fails. A failed connect left behind the shutdown handlers it had registered, so applications that create a client per request — or retry against a server that is unreachable, timing out, or exiting on startup — slowly accumulated handlers until Node warned about a possible leak. Failed attempts now release them, and a failed command-based connection no longer leaves its subprocess running.
