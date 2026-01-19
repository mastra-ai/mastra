---
"@mastra/deployer": patch
---

Fix a bug where `/openapi.json` was always generated during `mastra build`. The `server.build.openAPIDocs` setting is now observed.
