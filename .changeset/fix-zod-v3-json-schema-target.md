---
'@mastra/schema-compat': patch
---

Add support for `draft-2020-12` and `draft-04` JSON Schema targets in the Zod v3 adapter, and fix the `toJSONSchema` target mapping to properly translate all `zod-to-json-schema` target names (like `openApi3`) to standard-schema target names. Fixes "Unsupported JSON Schema target" errors when serializing tool schemas.
