---
'@mastra/core': patch
---

Fixed tool input validation failing when LLMs send null for optional fields. Zod's .optional() only accepts undefined, not null, causing validation errors with Gemini and other LLMs. Validation now retries with null values stripped when the initial attempt fails, so .optional() fields accept null while .nullable() fields continue to work correctly.
