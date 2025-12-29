---
"@mastra/core": patch
---

Fixed "Transforms cannot be represented in JSON Schema" error when using Zod v4 with structuredOutput

When using schemas with `.optional()`, `.nullable()`, `.default()`, or `.nullish().default("")` patterns with `structuredOutput` and Zod v4, users would encounter an error because OpenAI schema compatibility layer adds transforms that Zod v4's native `toJSONSchema()` cannot handle.

The fix uses Mastra's transform-safe `zodToJsonSchema` function which gracefully handles transforms by using the `unrepresentable: 'any'` option.

