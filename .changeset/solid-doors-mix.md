---
'@mastra/pg': minor
'@mastra/libsql': minor
---

Runs stored with the experimental workflow `storageVersion: 2` option can now be written by several workers at once, as evented workflows and `createEventedAgent` do. Concurrent `foreach` iterations all save their results, and the store writes a full copy of the workflow state after 100 changes so loading a long run stays fast.

If you stored version 2 runs with `@mastra/pg` 1.36.0-alpha.0 or `@mastra/libsql` 1.30.0-alpha.0, the store adds the columns this needs to the `mastra_workflow_runs` table on startup, and those runs keep working.
