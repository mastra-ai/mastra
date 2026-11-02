---
'@mastra/mcp': patch
---

Fixed `disconnect()` hanging, and stdio server processes being left running, when a server never answered its connection handshake. A connect that is still waiting is now closed when you call `disconnect()` or `reconnectServer()`, which stops the server process and lets `disconnect()` return right away.
