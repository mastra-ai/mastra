---
'@mastra/core': patch
---

Consume `ensureAllPropertiesRequired` from `@mastra/schema-compat` in the response-format execution path (`execute.ts`) to ensure structured output (`response_format`) schemas include all properties in the `required` array, fixing OpenAI strict mode rejections.
