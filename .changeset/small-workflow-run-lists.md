---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/pg': patch
---

Added a workflow run summary storage method in `@mastra/core` and a `/run-summaries` route in `@mastra/server`. The `@mastra/client-js` SDK exposes `runSummaries()`. Postgres projects run status and time without returning complete snapshots; the existing full-run endpoint remains unchanged.
