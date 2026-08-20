---
'@mastra/deployer': patch
---

Sweep idle HTTP connections periodically during graceful shutdown. A keep-alive socket whose in-flight response finished after the initial `closeIdleConnections()` call would stall the drain until the full `server.drainTimeout` expired; the server now exits as soon as in-flight work actually completes.
