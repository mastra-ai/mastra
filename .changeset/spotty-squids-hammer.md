---
'@mastra/core': patch
---

Fixed workflow snapshot persistence emitting duplicate durable operation IDs. Running a workflow on a durable engine such as `@mastra/inngest` logged `AUTOMATIC_PARALLEL_INDEXING` warnings whenever a step suspended, because two snapshot writes on the same execution path shared one operation ID. Each snapshot write now uses a distinct ID, so suspend, resume, cancel, pause and sleep runs no longer produce the warning. Fixes #21639.
