---
'@mastra/observability': patch
---

Fixed spans staying `RUNNING` in storage when a different process ended them under the `batch-with-updates` or `realtime` tracing strategy. This happens when a durable agent recovers a run after its process stopped and ends the original spans as interrupted. `MastraStorageExporter` now sends those ends straight to storage instead of waiting for a span start it never saw. Fixes [#27479](https://github.com/mastra-ai/mastra/issues/27479).

Ended spans don't change. Ending a span again is reported as a dropped event with the new `span-not-updatable` reason. The fix needs a storage provider with conditional span updates (in-memory, `@mastra/pg`, `@mastra/libsql`); other providers keep the previous behavior. `insert-only` and `event-sourced` weren't affected.
