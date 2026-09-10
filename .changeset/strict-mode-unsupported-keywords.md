---
'@mastra/schema-compat': patch
---

Strip strict-mode-unsupported JSON Schema keywords when preparing structured-output schemas for OpenAI strict mode. `prepareJsonSchemaForOpenAIStrictMode` now recursively removes keywords OpenAI Structured Outputs rejects (`uniqueItems`, `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`, `format`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `contains`, `minContains`, `maxContains`, `minProperties`, `maxProperties`, `patternProperties`, `unevaluatedItems`, `unevaluatedProperties`), folding constraint intent into each node's `description` the same way the tool path already does. This prevents 400 errors when a valid schema carrying these keywords is used as a structured-output schema on OpenAI strict endpoints.
