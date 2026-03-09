---
'@mastra/schema-compat': patch
---

Fixed Gemini rejecting supervisor agent tool schemas with nullable types. Nullable and nullish fields (e.g., `z.string().nullish()`) in agent delegation tool schemas now produce Gemini-compatible `nullable: true` format instead of union type arrays (`type: ["string", "null"]`) that cause HTTP 400 INVALID_ARGUMENT errors. Fixes #13988.
