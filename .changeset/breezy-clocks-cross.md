---
'@mastra/schema-compat': patch
---

Fix Zod v4 toJSONSchema bug with z.record() single-argument form

Zod v4 has a bug in the single-argument form of `z.record(valueSchema)` where it incorrectly assigns the value schema to `keyType` instead of `valueType`, leaving `valueType` undefined. This causes `toJSONSchema()` to throw "Cannot read properties of undefined (reading '_zod')" when processing schemas containing `z.record()` fields.

This fix patches affected schemas before conversion by detecting records with missing `valueType` and correctly assigning the schema to `valueType` while setting `keyType` to `z.string()` (the default). The patch recursively handles nested schemas including those wrapped in `.optional()`, `.nullable()`, arrays, unions, and objects.
