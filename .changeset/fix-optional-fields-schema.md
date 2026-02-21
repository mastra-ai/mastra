---
'@mastra/schema-compat': patch
---

Added `ensureAllPropertiesRequired` utility that populates the JSON Schema `required` array with all properties from converted schemas. This fixes OpenAI strict mode rejecting tool call and structured output schemas that had optional fields omitted from `required`. Note: nullable conversion for optional fields is handled separately by `processZodType` in the OpenAI compat layer (tool schemas only).
