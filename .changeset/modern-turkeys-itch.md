---
'@mastra/schema-compat': patch
---

fix(schema-compat): handle undefined values in optional fields for OpenAI compat layers

When a Zod schema has nested objects with `.partial()`, the optional fields would fail validation with "expected string, received undefined" errors. This occurred because the OpenAI schema compat layer converted `.optional()` to `.nullable()`, which only accepts `null` values, not `undefined`.

Changed `.nullable()` to `.nullish()` so that optional fields now accept both `null` (when explicitly provided by the LLM) and `undefined` (when fields are omitted entirely).

Fixes #11457
