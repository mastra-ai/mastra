---
'@mastra/core': minor
---

Added a storage contract for observability adapters to query thread identities using cross-trace predicates.

Trace and thread queries now accept any valid bounded time range instead of rejecting ranges longer than 31 days.
