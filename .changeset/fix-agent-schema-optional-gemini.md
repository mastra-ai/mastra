---
'@mastra/core': patch
---

Fixed sub-agent tool input schema to use `.optional()` instead of `.nullish()` for optional fields (`threadId`, `resourceId`, `instructions`, `maxSteps`). The previous `.nullish()` produced `anyOf: [T, {type: "null"}]` in JSON Schema, which Google Gemini's function calling API rejects. Using `.optional()` generates clean JSON Schema without `anyOf`, while the execute handler already handles null values via falsy checks so OpenAI compatibility is preserved.
