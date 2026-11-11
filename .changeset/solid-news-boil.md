---
'@mastra/schema-compat': patch
---

Fixed Gemini rejecting tools whose input schema has a numeric, boolean or empty-string literal, such as `z.literal(1)`, `z.literal(true)` or `z.union([z.string(), z.literal('')])`. Gemini only accepts non-empty string enums, so one such field made every request to the agent fail with HTTP 400. These fields are now sent as their plain type with the allowed values in the description. String enums from external JSON Schema that omit `type` now get `type: "string"`. Tool arguments are still validated against your original schema. Fixes #29167.
