---
'@mastra/schema-compat': patch
---

Fixed Gemini schema compatibility for tools that use required-only union constraints (e.g. "provide at least one of `name` or `kind`"). Made the Google API stop rejecting such schemas with a 400 (`required` only allowed for OBJECT type) by type-stamping those `anyOf` branches as objects while preserving their constraints. Follow-up to #22337, which worked around the same issue at the tool level.
