---
'@mastra/deployer': patch
---

Fixed a deployer server regression where leaving `server.host` unset could bind the Node server to `localhost` instead of preserving the runtime default host. Explicit `server.host` and `MASTRA_HOST` values continue to work as before.
