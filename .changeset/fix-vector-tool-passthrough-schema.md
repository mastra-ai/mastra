---
"@mastra/schema-compat": patch
"@mastra/rag": patch
---

Fix vector tool schema rejection when used in nested agent scenarios

When a supervisor agent calls a sub-agent that has a vector tool, LLM providers would reject the tool schema with "Invalid schema for function 'vectorTool': In context=('additionalProperties',), schema must have a 'type' key."

The issue was that `createVectorQueryTool` uses `.passthrough()` on its Zod schema, which Zod v4 converts to `additionalProperties: {}`. This empty object is invalid for LLM providers.

The fix converts empty `additionalProperties: {}` to `additionalProperties: true` during JSON schema conversion, which is valid JSON Schema meaning "allow any additional properties".

