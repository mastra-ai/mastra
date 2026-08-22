---
'@mastra/core': patch
'@mastra/redis-streams': patch
---

Keep cross-process thread leases scoped to the runtime that owns them, including during legacy lease migration, and prevent stale cleanup from releasing leases or clearing suspended-run state for runs resumed elsewhere.
