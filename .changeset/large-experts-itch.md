---
'@mastra/factory': patch
---

Improved Factory work-item concurrency by relying on atomic claims, idempotent replay, and serializable relationship transactions instead of distributed advisory locks.
