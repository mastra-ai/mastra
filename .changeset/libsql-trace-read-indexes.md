---
'@mastra/libsql': patch
---

Create read indexes for observability trace queries so listing traces and loading a single trace no longer scan the full `mastra_ai_spans` table or build a temporary B-tree for ordering. Adds `mastra_ai_spans_roots_started_at_idx` (partial index on `startedAt` for root spans) and `mastra_ai_spans_trace_started_at_idx` on `(traceId, startedAt)`, created idempotently on init for fresh, repeated, and existing databases.
