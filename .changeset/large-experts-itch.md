---
'@mastra/core': patch
'@mastra/factory': patch
'@mastra/pg': patch
---

Improved Factory work-item concurrency by replacing distributed advisory locks with atomic claims, idempotent replay, and serializable relationship transactions.
