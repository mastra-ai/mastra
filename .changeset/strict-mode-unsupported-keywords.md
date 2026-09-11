---
'@mastra/schema-compat': patch
---

Fixed structured output 400s on OpenAI strict endpoints by stripping JSON Schema validation keywords that strict mode rejects. `prepareJsonSchemaForOpenAIStrictMode` now recursively removes these keywords — including inside `$defs`/`definitions` referenced schemas — and folds their intent into each node's `description`, matching how the tool path already degrades constraints.

Keywords removed:

- Array: `uniqueItems`, `minItems`, `maxItems`
- String: `minLength`, `maxLength`, `pattern`, `format`
- Number: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`
- Structural (dropped, no useful mapping): `contains`, `minContains`, `maxContains`, `minProperties`, `maxProperties`, `patternProperties`, `unevaluatedItems`, `unevaluatedProperties`
