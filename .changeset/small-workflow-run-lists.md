---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/pg': patch
---

Added a workflow run summary endpoint for Studio's Recent Runs list. Postgres projects run status and time without returning complete snapshots; the existing full-run endpoint remains unchanged. Studio requests a run's input only when that run is selected.
