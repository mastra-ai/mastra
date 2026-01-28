---
'@mastra/core': patch
---

Fixed tool input validation failing when LLMs send null for optional fields. Zod's .optional() only accepts undefined, not null, causing validation errors with Gemini and other LLMs. Now null values in object properties are stripped before validation, treating them as 'not provided'.
