---
'@mastra/core': patch
---

Fixed an ESM circular import that crashed any test or app importing from `@mastra/core/workflows/workflow` with `TypeError: Class extends value undefined is not a constructor or null`. The `signal-drain-step` module now imports `createStep` from `workflows/workflow` directly instead of going through the `workflows` barrel, matching the convention used by every other step in the agentic-execution workflow.
