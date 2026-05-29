---
'@mastra/schema-compat': patch
---

Fixed Gemini REST tool calls failing for `z.discriminatedUnion`, `z.lazy`, and `z.tuple` inputs. `GoogleSchemaCompatLayer` now rewrites JSON Schema 2020-12 keywords into the OpenAPI 3.0 Schema Object subset that Gemini expects: `oneOf` → `anyOf`, `const` → `enum`, tuple `items: [array]` → `items: { anyOf: [...] }`, nullable `anyOf` collapse, `$ref` inlining with recursive schema support, and stripping of `$schema`/`additionalProperties`/`propertyNames`. Fixes #17057.
