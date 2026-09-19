---
'@mastra/mcp': patch
---

Fixed `MCPClient` leaking process exit hooks and `SIGTERM`/`SIGHUP` listeners when a connection attempt fails. Every failed connect (for example a timeout) left three handlers registered for the life of the process, which eventually triggered `MaxListenersExceededWarning` in apps that create a client per request. Handlers are now removed when connect fails and when `disconnect()` is called without an open transport.
