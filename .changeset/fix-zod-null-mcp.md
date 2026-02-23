---
"@mastra/schema-compat": patch
---

fix(schema-compat): coerce ZodNull instead of throwing for MCP tool schemas

MCP servers using `{ "type": "null" }` in tool JSON Schemas no longer crash mastracode. ZodNull is now coerced to `z.any().optional()` across all provider compatibility layers.
