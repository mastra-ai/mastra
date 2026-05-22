---
'@mastra/core': patch
---

Fixed `workflow.parallel()` type-checking for steps that declare `requestContextSchema`.
Steps with matching request context now type-check correctly.
Steps with mismatched request context still fail with a type error.
Fixes #16975.
