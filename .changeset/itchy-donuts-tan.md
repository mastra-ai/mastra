---
'@mastra/server': patch
---

Fixed 'Cannot read properties of undefined (reading typeName)' error when MCP tools or other non-Zod schema tools are registered. Both `serializeTool` (GET /tools) and `getSerializedAgentTools` (GET /agents) now correctly handle StandardSchemaWithJSON schemas instead of blindly calling zodToJsonSchema.
