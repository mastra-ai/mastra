---
'@mastra/mssql': patch
---

Added run fencing for durable agents. SQL Server stores now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Claims are kept in two new tables, `mastra_workflow_run_owners` and `mastra_memory_run_fences`, which are created on init. If you set `disableInit: true`, create them before upgrading. Durable agent runs fail to start until the tables exist.

Requires `@mastra/core` 1.75.0 or later.
