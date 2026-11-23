---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/turso': patch
---

Runs stored with the experimental workflow `storageVersion: 2` option now keep less in storage. When a step is written again, its earlier rows are deleted, including a running `foreach`'s progress. At the end of each run, versions of the workflow state that neither the run nor a nested run still reads are deleted. In a durable agent run paused for approval after 16 tool calls on `@mastra/pg`, the stored run shrank from 275 kB to 132 kB.

`init()` adds a `first_seq` column to the `mastra_workflow_run_entries` table, which keeps steps in the order they were first written. Runs stored before the upgrade keep working.

These stores now require `@mastra/core` 1.86.0 or newer, the first release that exports the state cleanup helper and table definitions they use.
