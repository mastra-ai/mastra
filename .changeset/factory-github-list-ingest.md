---
'@mastra/factory': patch
---

Fixed the GitHub issues and pull request lists returning a 502 `github_fetch_failed` error when re-ingesting the listed items into Factory rules failed. The lists now load and the ingestion failure is logged.
