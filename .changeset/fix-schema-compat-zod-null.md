---
'@mastra/schema-compat': patch
---

fix(schema-compat): handle ZodNull type in Anthropic and OpenAI Reasoning providers

MCP servers using `{ "type": "null" }` in their tool JSON Schemas caused a crash (`does not support zod type: ZodNull`) because the Anthropic and OpenAI Reasoning compatibility layers didn't handle `ZodNull`, falling through to the unsupported type handler which throws unconditionally.

Added `ZodNull` coercion (to `z.any().refine(v => v === null)`) in both providers, matching the existing pattern already used by the Google provider.
