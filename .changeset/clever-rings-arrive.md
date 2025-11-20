---
'@mastra/core': patch
---

Normalize undefined input to {} for objects with all-optional fields in tool validation.

This fixes an edge case where LLMs or tool calls send undefined instead of an empty object for optional arguments, which previously resulted in a validation error ("root: Required") even when all schema fields were optional.

Resolves: #10031
