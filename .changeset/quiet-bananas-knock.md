---
'@mastra/core': patch
---

Fix tool input validation to use schema-compat transformed schemas

Previously, tool input validation used the original Zod schema while the LLM received a schema-compat transformed version. This caused validation failures when LLMs (like OpenAI o3 or Claude 3.5 Haiku) sent arguments matching the transformed schema but not the original.

For example:
- OpenAI o3 reasoning models convert `.optional()` to `.nullable()`, sending `null` values
- Claude 3.5 Haiku strips `min`/`max` string constraints, sending shorter strings
- Validation would reject these valid responses because it checked against the original schema

The fix ensures validation uses the same schema-compat processed schema that was sent to the LLM, eliminating this mismatch.
