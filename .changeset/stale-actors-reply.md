---
'@mastra/deployer': patch
---

Fixed `mastra build` failing with "Cannot find package '@hono/node-server'" in projects installed with pnpm. The deployer now declares @hono/node-server as a runtime dependency and falls back to project-level resolution when a hono package cannot be resolved from the deployer itself.
