---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added stored MCP servers CRUD API with full create, read, update, and delete endpoints. MCP server listing and detail routes now resolve both code-defined and stored servers, ensuring the playground shows accurate data for stored server configurations after edits.
