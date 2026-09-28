---
'@mastra/schema-compat': patch
---

Fixed `zodToJsonSchema` so nullable Zod v4 enums and literals still accept `null`. A field like `z.enum(['red', 'blue']).nullable()` was exported as `{ type: ['string', 'null'], enum: ['red', 'blue'] }`, which rejects `null`. The exported schema now lists `null` among the allowed values, so tool parameters, OpenAPI schemas and dataset schemas match the Zod schema again. Fixes [#24516](https://github.com/mastra-ai/mastra/issues/24516).
