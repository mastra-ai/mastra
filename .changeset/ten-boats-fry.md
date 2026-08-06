---
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Removed an unused legacy A2A request handler

Deleted a dead, unreferenced A2A handler module. The deployer serves A2A through the shared server routes, which now support protocol v1.
