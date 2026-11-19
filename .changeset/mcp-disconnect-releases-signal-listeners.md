---
'@mastra/mcp': patch
---

Fixed `MCPClient` leaving its process `SIGINT`, `SIGTERM`, and `SIGHUP` listeners installed after `disconnect()`, so a host that disconnects its clients now finishes its own awaited shutdown instead of being ended by the next signal. The listeners are installed only while at least one client holds a hook and removed once the last one is released (#29547). `SIGHUP` now exits with code `129` (`128` + the signal's number), matching `SIGINT` and `SIGTERM`.
