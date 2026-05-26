---
'@mastra/schema-compat': patch
---

Fixed Gemini REST tool calls failing for `z.discriminatedUnion`, `z.lazy` (recursive), and `z.tuple` tool inputs. `GoogleSchemaCompatLayer` now emits the OpenAPI 3.0 Schema Object shape Gemini's API expects: `oneOf` becomes `anyOf`, string `const` becomes single-value `enum`, `$ref` / `definitions` from recursive schemas are inlined one level then collapsed to opaque `object`, array-form `items` from tuples becomes a single-schema `anyOf`, and `$schema` / `additionalProperties` / `propertyNames` are stripped. Tool args now validate against the schema and reach `execute()` on `gemini-2.5-flash` and `gemini-2.5-pro`.

Fixes [#17057](https://github.com/mastra-ai/mastra/issues/17057).
