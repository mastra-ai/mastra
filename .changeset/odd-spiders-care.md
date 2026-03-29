---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fix `mcpOptions` being ignored when creating `MastraServer` through the deployer path. The deployer now forwards `server.mcpOptions` so `serverless` mode and custom `sessionIdGenerator` are applied correctly.
