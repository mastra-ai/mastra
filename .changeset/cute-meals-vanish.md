---
'@mastra/schema-compat': patch
---

Fixed OpenAI schema validation error when using passthrough schemas with tools like `vectorQueryTool`.

**What was happening:** Tools using `.passthrough()` or `z.looseObject()` schemas (like the RAG `vectorQueryTool`) would fail with OpenAI models, returning the error: "Invalid schema for function: In context=('additionalProperties',), schema must have a 'type' key."

**What changed:** The OpenAI schema compatibility layer now converts passthrough schemas to strict object schemas, producing valid `additionalProperties: false` instead of the invalid empty object `{}` that Zod v4 generates.

Fixes #11823
