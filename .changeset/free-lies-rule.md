---
'@mastra/core': patch
---

Fix Zod 4 compatibility in `getZodTypeName` utility

The `getZodTypeName` function now correctly detects Zod type names for both Zod 3 and Zod 4. Zod 4 uses `_def.type` with lowercase values (e.g., `"optional"`, `"nullable"`, `"string"`) instead of Zod 3's `_def.typeName` with prefixed values (e.g., `"ZodOptional"`, `"ZodNullable"`, `"ZodString"`).

This fixes issues when using Zod 4 where:
- `buildStorageSchema` would not correctly detect nullable/optional fields, causing `NOT NULL constraint failed` errors in storage operations
- Schema unwrapping for database column generation would fail to identify wrapper types like `ZodOptional`, `ZodNullable`, and `ZodDefault`
