# RAG Tracing Plan

Issue: mastra-ai/mastra#10898

Goal: surface RAG operations (ingestion + query) in Mastra's AI tracing so users
can debug retrieval quality and ingestion pipelines end-to-end.

## Background

Today the AI tracing system in `packages/core/src/observability/types/tracing.ts`
defines the following root span types: `AGENT_RUN`, `WORKFLOW_RUN`, and (when run
standalone) `SCORER_RUN`. RAG tools (`createVectorQueryTool`,
`createGraphRAGTool`, `createDocumentChunkerTool`) are wrapped in `TOOL_CALL`
spans when invoked from an agent, but nothing inside `packages/rag` creates
child spans — `vectorQuerySearch`, `rerank`, `GraphRAG.query`, `MDocument.chunk`,
metadata extractors, and vector store `upsert`/`query` are all opaque.

Ingestion has no entry point that gets traced at all: users call
`MDocument.chunk(...)`, `embed(...)`, then `vectorStore.upsert(...)` directly.
There is no agent or workflow above it, so there is no current root span.

## New span types

Add to `SpanType` in `packages/core/src/observability/types/tracing.ts`:

### Root
- `RAG_INGESTION_RUN` — new root span type. Joins `AGENT_RUN`, `WORKFLOW_RUN`,
  `SCORER_RUN` as a top-level entry. Wraps a complete ingestion pipeline run
  (load → chunk → extract → embed → upsert).

### Children
- `RAG_CHUNK` — document chunking (one per transformer invocation).
- `RAG_EXTRACT_METADATA` — metadata extractor pass (title/summary/questions/
  keywords/schema). One child per extractor; each typically issues an LLM call
  that will further nest as `MODEL_GENERATION`.
- `RAG_EMBEDDING` — embedding call (batch). Used by both ingestion and query.
- `RAG_VECTOR_UPSERT` — vector store write.
- `RAG_VECTOR_QUERY` — vector store read/search.
- `RAG_RERANK` — rerank pass (cohere / mastra-agent / zeroentropy).
- `RAG_GRAPH_BUILD` — `GraphRAG.createGraph`.
- `RAG_GRAPH_TRAVERSAL` — `GraphRAG.query` graph walk.

We deliberately do not add a `RAG_QUERY_RUN` root: query always happens inside
an agent's `TOOL_CALL` (or directly in user code where the existing
`getOrCreateSpan` semantics will create a `GENERIC` parent if needed). The
top-level "rag query" framing is the existing tool-call span; the new children
plug into it.

### Attribute shapes

Add per-type attribute interfaces extending `AIBaseAttributes` and wire them
into `SpanTypeMap`:

- `RagIngestionRunAttributes`: `{ pipelineName?, sourceCount?, vectorStore?,
  indexName?, embeddingModel?, embeddingProvider?, totalChunks?, totalTokens? }`
- `RagChunkAttributes`: `{ strategy, chunkSize?, chunkOverlap?, inputBytes?,
  chunkCount? }`
- `RagExtractMetadataAttributes`: `{ extractor: 'title'|'summary'|'questions'|
  'keywords'|'schema', model?, provider? }`
- `RagEmbeddingAttributes`: `{ model, provider, dimensions?, inputCount,
  totalTokens?, mode: 'ingest'|'query' }`
- `RagVectorUpsertAttributes`: `{ store, indexName, vectorCount, dimensions? }`
- `RagVectorQueryAttributes`: `{ store, indexName, topK, filter?, returned? }`
- `RagRerankAttributes`: `{ provider, model?, candidateCount, topN, scorer? }`
- `RagGraphBuildAttributes`: `{ nodeCount, edgeCount, threshold? }`
- `RagGraphTraversalAttributes`: `{ startNodes, maxDepth, visited?, returned? }`

## Wiring (query path)

All wiring uses the existing pattern: pull
`observabilityContext.tracingContext?.currentSpan` (or accept a
`tracingContext` param), call `createChildSpan({...})`, then `.end({ output })`
or `.error({ error })`. Reference: `packages/core/src/llm/model/model.ts:185`,
`packages/core/src/processors/runner.ts:58`.

Files to change:

1. `packages/rag/src/tools/vector-query.ts`
   - In `execute`, the tool already runs inside a `TOOL_CALL` span via the
     agent runner. Thread `tracingContext` from the tool execution context
     down into `vectorQuerySearch`, `rerank`, and source conversion.
2. `packages/rag/src/utils/vector-search.ts` (`vectorQuerySearch`)
   - Accept `tracingContext`. Create `RAG_EMBEDDING` (mode: 'query') around the
     `embedV1/v2/v3` call, and `RAG_VECTOR_QUERY` around `vectorStore.query`.
3. `packages/rag/src/rerank/index.ts` (`rerank`, `rerankWithScorer`)
   - Accept `tracingContext`. Wrap in `RAG_RERANK`. Inner LLM-based scorers
     will already create `MODEL_GENERATION` children if they have access to
     the context.
4. `packages/rag/src/tools/graph-rag.ts` + `packages/rag/src/graph-rag/index.ts`
   - Wrap `createGraph` in `RAG_GRAPH_BUILD` and `query` in
     `RAG_GRAPH_TRAVERSAL`. The embed + vector query inside still produce
     `RAG_EMBEDDING` + `RAG_VECTOR_QUERY` children as in (2).
5. `packages/rag/src/tools/document-chunker.ts`
   - Accept `tracingContext`, wrap `MDocument.chunk` call in `RAG_CHUNK`.

For users who call `vectorQuerySearch` outside an agent, all functions accept
an optional `tracingContext` and no-op when absent (matches the existing
processor-runner pattern).

## Wiring (ingestion path)

Ingestion has no implicit parent today, so we need a way to start a
`RAG_INGESTION_RUN` root span. Two complementary entry points:

1. **Helper API** — add `mastra.observability.startRagIngestion({ name,
   attributes, metadata })` (or a small standalone helper exported from
   `@mastra/rag`) that calls `getOrCreateSpan({ type:
   SpanType.RAG_INGESTION_RUN, ... })` exactly the way `Agent.run` does at
   `packages/core/src/agent/agent.ts:4537`. Returns a `tracingContext` that the
   user passes into chunk/embed/upsert calls. Closed with `.end({...})` or
   `.error({...})`.
2. **Instrumented helpers** — extend `MDocument.chunk` to accept an optional
   `tracingContext` and emit `RAG_CHUNK` + `RAG_EXTRACT_METADATA` children.
   Extend `MastraVector.upsert`/`query` base contract to accept
   `tracingContext` and emit `RAG_VECTOR_UPSERT`/`RAG_VECTOR_QUERY` children
   (default no-op so existing store implementations keep working without
   changes; only the base wrapper needs updating).

Files to change:

1. `packages/core/src/observability/types/tracing.ts` — add span types,
   attribute interfaces, `SpanTypeMap` entries. Mark `RAG_INGESTION_RUN` as a
   root in jsdoc next to `AGENT_RUN`/`WORKFLOW_RUN`.
2. `packages/core/src/vector/index.ts` (or wherever `MastraVector` lives) —
   thread `tracingContext` through `upsert`/`query` wrappers, emit child spans.
3. `packages/rag/src/document/document.ts` — `MDocument.chunk` accepts
   `tracingContext`, wraps each transformer in `RAG_CHUNK`.
4. `packages/rag/src/document/extractors/*` — accept `tracingContext`, wrap
   each extractor LLM pass in `RAG_EXTRACT_METADATA`.
5. New: `packages/rag/src/tracing.ts` — small helper exporting
   `startRagIngestion(...)` that wraps `getOrCreateSpan` so users can start a
   root ingestion span without reaching into core internals.

## Public surface / DX

Example user-facing pattern after the change:

```ts
import { startRagIngestion } from '@mastra/rag/tracing';

const span = startRagIngestion({
  mastra,
  name: 'docs ingestion',
  attributes: { vectorStore: 'pgvector', indexName: 'docs' },
});
try {
  const chunks = await doc.chunk({ tracingContext: span.tracingContext });
  const { embeddings } = await embed(chunks, { tracingContext: span.tracingContext });
  await vectorStore.upsert({ indexName: 'docs', vectors: embeddings,
    tracingContext: span.tracingContext });
  span.end({ output: { chunkCount: chunks.length } });
} catch (err) {
  span.error({ error: err });
  throw err;
}
```

Query path is automatic — agents using `createVectorQueryTool` get
`RAG_EMBEDDING` + `RAG_VECTOR_QUERY` (+ optional `RAG_RERANK`) children under
the existing `TOOL_CALL` span with no user changes.

## Out of scope / follow-ups

- Per-store native tracing (e.g. pgvector EXPLAIN). The base `RAG_VECTOR_QUERY`
  span captures latency + topK; deeper store-specific attributes can land per
  store later.
- Token-level streaming embeddings.
- Auto-hooking `MDocument` so any chunk call without a `tracingContext`
  implicitly starts a `RAG_INGESTION_RUN`. We should keep this opt-in initially
  to avoid surprise root spans in unrelated user code.

## Test plan

- Unit: span creation/attribute defaults in `tracing.test.ts`.
- Integration: `packages/rag` tests that exercise `vectorQuerySearch`,
  `rerank`, and `GraphRAG.query` under a fake exporter and assert the child
  span tree shape.
- Ingestion: a test that starts `RAG_INGESTION_RUN`, runs chunk → embed →
  upsert against an in-memory vector store, and asserts the recorded tree
  contains exactly the expected child types.

## Docs

- Update `docs/` RAG section with a tracing subsection (follow
  `docs/AGENTS.md`).
- Add the new span types to the observability reference page.

## Changeset

Minor changeset against `@mastra/core` and `@mastra/rag` (and any vector
store base package touched). Follow `.mastracode/commands/changeset.md`.
