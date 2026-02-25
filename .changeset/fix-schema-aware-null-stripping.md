---
"@mastra/core": patch
---

fix(tools): schema-aware null stripping preserves .nullable() fields (#13419)

When LLMs send null for optional fields, `stripNullishValues` now checks the Zod schema to preserve null for `.nullable()` fields while still stripping null from `.optional()`-only fields.
