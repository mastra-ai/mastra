---
'@mastra/playground-ui': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
