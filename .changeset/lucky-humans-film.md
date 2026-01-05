---
'@mastra/schema-compat': patch
---

Fix OpenAI structured output compatibility for fields with `.default()` values

When using Zod schemas with `.default()` fields (e.g., `z.number().default(1)`), OpenAI's structured output API was failing with errors like `Missing '<field>' in required`. This happened because `zod-to-json-schema` doesn't include fields with defaults in the `required` array, but OpenAI requires all properties to be required.

This fix converts `.default()` fields to `.nullable()` with a transform that returns the default value when `null` is received, ensuring compatibility with OpenAI's strict mode while preserving the original default value semantics.
