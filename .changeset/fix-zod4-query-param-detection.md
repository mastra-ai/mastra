---
'@mastra/server': patch
---

fix(server): support Zod v4 in query parameter type detection

`wrapSchemaForQueryParams` relied on `_def.typeName` to detect complex schema types (objects, arrays, records) that need JSON parsing from query strings. Zod v4 uses `_def.type` with lowercase values instead, causing all complex fields to be treated as simple strings. This broke date range filters, tags, and metadata filters in the Studio Observability UI when users had Zod v4 installed.
