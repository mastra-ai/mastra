---
"@mastra/core": patch
---

Fixed input validation to preserve null for nullable fields and strip null for optional-only fields.

When LLMs send null for optional fields, input validation now checks the schema to distinguish `.nullable()` from `.optional()`. Nullable fields keep their null values, while optional-only fields have null stripped as before.
