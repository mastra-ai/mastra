---
'@mastra/core': minor
'@mastra/rag': minor
---

Add RAG observability (#10898)

Surfaces RAG ingestion and query operations in Mastra's AI tracing.

New span types in `@mastra/core/observability`:

- `RAG_INGESTION` (root) — wraps an ingestion pipeline run
- `RAG_EMBEDDING` — embedding call (used by ingestion and query)
- `RAG_VECTOR_OPERATION` — vector store I/O (`query`/`upsert`/`delete`/`fetch`)
- `RAG_ACTION` — `chunk` / `extract_metadata` / `rerank`
- `GRAPH_ACTION` — non-RAG graph `build` / `traverse` / `update` / `prune`

New helpers exported from `@mastra/core/observability`:

- `startRagIngestion(opts)` — manual: returns `{ span, observabilityContext }`
- `withRagIngestion(opts, fn)` — scoped: runs `fn(observabilityContext)`,
  attaches the return value as the span's output, routes thrown errors to
  `span.error(...)`

Wired in `@mastra/rag`:

- `vectorQuerySearch` emits `RAG_EMBEDDING` (mode: `query`) and
  `RAG_VECTOR_OPERATION` (operation: `query`)
- `rerank` / `rerankWithScorer` emit `RAG_ACTION` (action: `rerank`)
- `MDocument.chunk` emits `RAG_ACTION` (action: `chunk`) and
  `RAG_ACTION` (action: `extract_metadata`)
- `createGraphRAGTool` emits `GRAPH_ACTION` (action: `build` / `traverse`)
- `createVectorQueryTool` and `createGraphRAGTool` thread
  `observabilityContext` from the agent's `TOOL_CALL` span automatically

All new instrumentation is opt-in: functions accept an optional
`observabilityContext` and no-op when absent, so existing callers are
unaffected.
