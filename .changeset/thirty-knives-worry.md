---
'@mastra/deployer': patch
---

Fixed Mastra dev server defaulting to bind on `0.0.0.0` (all network interfaces) while logging that it was running on `localhost`. The dev server now defaults the bind address to `localhost`, matching the log message and avoiding silent network exposure. Set `serverOptions.host` or `MASTRA_HOST=0.0.0.0` when the server needs to be reachable beyond the loopback adapter. Closes #17906.
