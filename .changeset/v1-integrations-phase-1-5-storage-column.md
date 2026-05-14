---
'@mastra/core': minor
'@mastra/libsql': minor
---

Add `toolIntegrations` storage column to agent versions schema. The TypeScript shape was added in the prior Phase 1 change; this completes persistence by wiring the column through the libsql adapter and the filesystem snapshot allowlist. In-memory adapter already round-trips arbitrary fields. The column is nullable; no backfill is needed.
