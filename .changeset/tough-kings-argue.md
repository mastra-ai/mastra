---
'@mastra/schema-compat': patch
---

Fixed `ZodNull` types (from MCP tool schemas with `{ "type": "null" }`) causing a startup crash instead of being gracefully handled. MCP servers that use null types in their tool schemas will now work correctly with all AI providers.
