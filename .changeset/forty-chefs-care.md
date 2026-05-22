---
'@mastra/core': patch
---

Fixed type error when using `parallel()` with steps that declare a `requestContextSchema`. The `parallel()` method was dropping the workflow's request-context generic when validating each step, which produced a misleading "Expected Step with state schema that is a subset of workflow state" error for steps with a typed request context. Fixes #16975.
