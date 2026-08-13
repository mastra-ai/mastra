---
'@mastra/core': patch
---

Fixed CoreToolBuilder dropping the `~standard.jsonSchema` adapter when injecting background/resume fields onto Zod v4 tool input schemas. Invalid tool calls now return structured validation errors instead of crashing during JSON Schema conversion.
