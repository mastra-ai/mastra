---
'@mastra/schema-compat': patch
---

Fixed Zod 4 schemas with `.transform()` producing the wrong JSON Schema for structured output and tool calling. The generated schema now describes the pre-transform input the model must produce instead of the post-transform output, so a field like `z.string().transform(JSON.parse)` is advertised as a `string` rather than `string | number | boolean | null`.
