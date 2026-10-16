---
'@mastra/pg': minor
'@mastra/core': patch
---

Observational memory now coordinates its background work (buffering, observing, reflecting) across processes when using Postgres. Claims are stored in a new `mastra_om_operation_claims` table with a TTL, so multiple server replicas sharing one database no longer double-buffer or double-reflect the same thread, and a crashed replica's claim expires instead of blocking forever. Other adapters keep the existing single-process behavior.
