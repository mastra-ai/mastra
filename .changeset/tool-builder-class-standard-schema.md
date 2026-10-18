---
'@mastra/core': patch
---

Fixed agents crashing with `Class constructor ... cannot be invoked without 'new'` when a tool's schema is a class-based Standard Schema, such as an Effect `Schema.Class` adapted with `Schema.toStandardSchemaV1`. Tools can now use class-based schemas the same way as `Schema.Struct`.
