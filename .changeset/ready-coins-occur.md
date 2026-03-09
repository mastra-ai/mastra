---
'@mastra/schema-compat': patch
---

Fixed OpenAI and OpenAI Reasoning compat layers to ensure all properties appear in the JSON Schema required array when using processToJSONSchema. This prevents OpenAI strict mode rejections for schemas with optional, default, or nullish fields. (Fixes #12284)
