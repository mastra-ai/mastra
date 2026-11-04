---
'@mastra/core': patch
---

Fixed a nested workflow run's stored snapshot dropping its parent workflow while the run executed a step inside `.parallel()` or `.branch()`. Reading the run at that point, or restarting it after a crash there, now keeps the link to its parent.
