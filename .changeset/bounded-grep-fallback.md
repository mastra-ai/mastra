---
'@mastra/core': patch
---

Workspace grep no longer hangs when native sandbox grep fails. The host-side fallback search now stops after 60 seconds (configurable via `MASTRA_WORKSPACE_GREP_HOST_BUDGET_MS`) or when the run is aborted, and the result says the search was incomplete and how many files were scanned. The log line for the fallback now includes why native grep was not usable.
