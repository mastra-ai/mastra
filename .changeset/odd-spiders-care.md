---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed an issue where MCP server options in Mastra server config were not applied when using the deployer, so serverless mode and custom session IDs now work as expected.
