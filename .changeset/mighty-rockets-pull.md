---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/core': patch
---

Added exact thread binding to native Session requests, so a command arriving first after a server restart reaches the selected stored thread.
