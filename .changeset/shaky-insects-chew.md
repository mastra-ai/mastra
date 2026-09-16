---
'@mastra/schema-compat': patch
---

Fixed `@mastra/schema-compat/json-to-zod` failing with "jsonSchemaToZod is not a function" when loaded from CommonJS, and generated schemas now use `z.record(z.string(), value)` so JSON Schemas with `additionalProperties` or `patternProperties` validate correctly on Zod v4 before 4.4.0 (including zod@3.25's `zod/v4`). Fixes dataset `addItem` and tool schema conversion crashing on record-shaped schemas. See https://github.com/mastra-ai/mastra/issues/23993
