---
'@mastra/core': minor
---

Added observability tracing for embed and upsert steps during RAG ingestion. New `embedForIngestion()` function emits `RAG_EMBEDDING` spans with `mode: 'ingest'`, and new `upsertWithTracing()` method on `MastraVector` emits `RAG_VECTOR_OPERATION` spans with `operation: 'upsert'`. Both are opt-in via `observabilityContext` — existing callers are unaffected. Follow-up to #15137.
