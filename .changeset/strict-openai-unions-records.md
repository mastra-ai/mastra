---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed two OpenAI errors with tool inputs and structured output:

- Optional tool inputs that accept more than one type can now be left empty. Before, OpenAI models filled them with made-up values.
- Structured output with a field that has free-form keys, such as `z.record(z.string(), z.string())`, now works on OpenAI instead of failing with a 400 error. These schemas are sent without strict mode. To keep strict mode anyway, set `providerOptions.openai.strictJsonSchema: true`.
