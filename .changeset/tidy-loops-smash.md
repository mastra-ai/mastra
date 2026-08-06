---
'@mastra/client-js': minor
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Updated the client A2A resource to speak protocol v1

The client's A2A methods now send v1 message shapes and method names with an `A2A-Version: 1.0` header. Because Mastra's server negotiates both versions, existing setups keep working; calls against a v1 server now use the v1 wire format end to end.
