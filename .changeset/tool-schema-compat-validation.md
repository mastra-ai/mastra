---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

Fixed tool execute-time input validation for Zod tools on Anthropic Claude 3.5 Haiku. The compat layer now skips string min/max checks that were removed from the model-facing JSON Schema, while preserving refinements, defaults, and other validation semantics.
