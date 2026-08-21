---
'@mastra/duckdb': patch
---

Fixed metadata filters conflating value types — `{ count: 5 }` no longer matches a stored string `'5'`, and filtering on `null` metadata values now works. Nested object filters now compare structurally, so key serialization order doesn't affect matching.
