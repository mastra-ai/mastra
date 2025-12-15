---
'@mastra/core': patch
---

Fix Zod 4 compatibility issue with structuredOutput in agent.generate()

Users with Zod 4 installed would see `TypeError: undefined is not an object (evaluating 'def.valueType._zod')` when using `structuredOutput` with agent.generate(). This happened because ProcessorStepSchema contains `z.custom()` fields that hold user-provided Zod schemas, and the workflow validation was trying to deeply validate these schemas causing version conflicts.

The fix disables input validation for processor workflows since `z.custom()` fields are meant to pass through arbitrary types without deep validation.
