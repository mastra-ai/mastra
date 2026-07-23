---
'@mastra/factory': patch
---

Improved Factory work-item concurrency by relying on atomic database claims and idempotent replay instead of holding distributed locks.
