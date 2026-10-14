---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed two OpenAI structured-output and tool schema failures:

- Optional `anyOf` properties in plain JSON Schema tools (for example from MCP servers) now accept `null`, so models leave them unset instead of inventing a value.
- Structured output with a `z.record()` field now works on OpenAI. Strict mode cannot express free-form keys, so these schemas are sent non-strict instead of failing with a 400. Pass `providerOptions.openai.strictJsonSchema: true` to keep strict mode.
