---
'@mastra/core': patch
---

Fixed agents-as-tools failing with OpenAI when using the model router. The auto-injected `resumeData` field (from `z.any()`) produced a JSON Schema without a `type` key, which OpenAI rejects. Tool schemas are now post-processed to ensure all properties have valid type information.
