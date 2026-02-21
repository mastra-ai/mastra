---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

Fixed optional fields being omitted from the `required` array in converted JSON Schemas, which caused OpenAI strict mode to reject tool calls. All properties are now included in `required` with proper `nullable` handling for optional fields.
