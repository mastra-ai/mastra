# RAG Observability Plan

Issue: mastra-ai/mastra#10898

Goal: surface RAG operations (ingestion + query) in Mastra's AI observability
(tracing, plus future logs/metrics) so users can debug retrieval quality and
ingestion pipelines end-to-end.

Note on terminology: this is **observability**, not just tracing. All new APIs
should accept and thread an `ObservabilityContext` (full or partial) rather
than a bare `tracingContext`. Tracing is the first consumer; logs/metrics
hang off the same context later without another API churn.

## Background

Today the AI tracing system in `packages/core/src/observability/types/tracing.ts`
defines the following root span types: `AGENT_RUN`, `WORKFLOW_RUN`, and (when
run standalone) `SCORER_RUN`. RAG tools (`createVectorQueryTool`,
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
- `RAG_INGESTION` — new root span type. Joins `AGENT_RUN`, `WORKFLOW_RUN`,
  `SCORER_RUN` as a top-level entry. Wraps a complete ingestion pipeline run
  (load → chunk → extract → embed → upsert).

### Children
Keep this small. Three child types cover everything:

- `RAG_EMBEDDING` — embedding call (batch). Used by both ingestion and query.
  Kept distinct because it's the fundamental RAG primitive and users will
  filter on it constantly.
- `RAG_VECTOR_OPERATION` — vector store I/O. Single span type with an
  `operation: 'query' | 'upsert' | 'delete' | 'fetch'` attribute.
- `RAG_ACTION` — catch-all for everything else, distinguished by an
  `action` attribute:
  - `'chunk'` — `MDocument.chunk` / a transformer pass
  - `'extract_metadata'` — title/summary/questions/keywords/schema extractor
    (LLM calls inside still nest as `MODEL_GENERATION`)
  - `'rerank'` — rerank pass
  - `'graph_build'` — `GraphRAG.createGraph`
  - `'graph_traverse'` — `GraphRAG.query` walk

That's 1 root + 3 children. We can promote any `RAG_ACTION` variant to its own
type later if a UI affordance demands it; demoting is harder.

### Attribute shapes

Add per-type attribute interfaces extending `AIBaseAttributes` and wire them
into `SpanTypeMap`:

- `RagIngestionAttributes`: `{ pipelineName?, sourceCount?, vectorStore?,
  indexName?, embeddingModel?, embeddingProvider?, totalChunks?, totalTokens? }`
- `RagEmbeddingAttributes`: `{ model, provider, dimensions?, inputCount,
  totalTokens?, mode: 'ingest' | 'query' }`
- `RagVectorOperationAttributes`: `{ operation: 'query'|'upsert'|'delete'|
  'fetch', store, indexName, vectorCount?, topK?, filter?, dimensions?,
  returned? }`
- `RagActionAttributes`: `{ action: 'chunk'|'extract_metadata'|'rerank'|
  'graph_build'|'graph_traverse', /* discriminated extras */ strategy?,
  chunkSize?, chunkOverlap?, chunkCount?, extractor?, model?, provider?,
  candidateCount?, topN?, scorer?, nodeCount?, edgeCount?, maxDepth?,
  visited?, returned? }`

## Wiring (query path)

All wiring uses the existing pattern but threads `ObservabilityContext`
(or the relevant subset) through, not a bare `tracingContext`. Inside, we
read `observabilityContext.tracingContext?.currentSpan` and call
`createChildSpan({...})`. Reference: `packages/core/src/llm/model/model.ts:185`,
`packages/core/src/processors/runner.ts:58`.

Files to change:

1. `packages/rag/src/tools/vector-query.ts`
   - In `execute`, the tool already runs inside a `TOOL_CALL` span via the
     agent runner. Pull `observabilityContext` from the tool execution context
     and thread it into `vectorQuerySearch`, `rerank`, and source conversion.
2. `packages/rag/src/utils/vector-search.ts` (`vectorQuerySearch`)
   - Accept `observabilityContext`. Create `RAG_EMBEDDING` (mode: 'query')
     around the `embedV1/v2/v3` call and `RAG_VECTOR_OPERATION`
     (operation: 'query') around `vectorStore.query`.
3. `packages/rag/src/rerank/index.ts` (`rerank`, `rerankWithScorer`)
   - Accept `observabilityContext`. Wrap in `RAG_ACTION` (action: 'rerank').
     Inner LLM-based scorers will already create `MODEL_GENERATION` children
     if they receive the context.
4. `packages/rag/src/tools/graph-rag.ts` + `packages/rag/src/graph-rag/index.ts`
   - Wrap `createGraph` in `RAG_ACTION` (action: 'graph_build') and `query` in
     `RAG_ACTION` (action: 'graph_traverse'). The embed + vector query inside
     still produce `RAG_EMBEDDING` + `RAG_VECTOR_OPERATION` children as in (2).
5. `packages/rag/src/tools/document-chunker.ts`
   - Accept `observabilityContext`, wrap `MDocument.chunk` in `RAG_ACTION`
     (action: 'chunk').

For users who call `vectorQuerySearch` outside an agent, all functions accept
an optional `observabilityContext` and no-op when absent (matches the existing
processor-runner pattern).

## Wiring (ingestion path)

Ingestion has no implicit parent today, so we need a way to start a
`RAG_INGESTION` root span. Two complementary entry points:

1. **Direct `getOrCreateSpan`** — power users can already call
   `getOrCreateSpan({ type: SpanType.RAG_INGESTION, ... })` from
   `@mastra/core/observability` and pass the resulting `observabilityContext`
   into chunk/embed/upsert calls. This is the same shape `Agent.run` uses at
   `packages/core/src/agent/agent.ts:4537` and is the "no magic" path.
2. **Thin helper in `@mastra/core/observability`** — `startRagIngestion(...)`
   is just a typed wrapper around `getOrCreateSpan` that pins
   `type: SpanType.RAG_INGESTION` and the `RagIngestionAttributes` shape.
   Lives next to the other observability helpers in core (not in
   `@mastra/rag`) so non-RAG code paths and other languages of integration
   don't need to depend on the RAG package just to start a root span.

Files to change:

1. `packages/core/src/observability/types/tracing.ts` — add span types,
   attribute interfaces, `SpanTypeMap` entries. Mark `RAG_INGESTION` as a
   root in jsdoc next to `AGENT_RUN`/`WORKFLOW_RUN`.
2. `packages/core/src/observability/index.ts` (or sibling) — export
   `startRagIngestion`, a thin wrapper around `getOrCreateSpan`.
3. `packages/core/src/vector/index.ts` (or wherever `MastraVector` lives) —
   thread `observabilityContext` through `upsert`/`query`/`delete`/`fetch`
   wrappers, emit `RAG_VECTOR_OPERATION` child spans. Default no-op so
   existing store implementations keep working without changes; only the
   base wrapper needs updating.
4. `packages/rag/src/document/document.ts` — `MDocument.chunk` accepts
   `observabilityContext`, emits `RAG_ACTION` (action: 'chunk').
5. `packages/rag/src/document/extractors/*` — accept `observabilityContext`,
   emit `RAG_ACTION` (action: 'extract_metadata') around the LLM pass.

## Public surface / DX

The previous draft made the user juggle a span object and thread a
`tracingContext` field by hand. Better: hand back an
`ObservabilityContext` directly, and offer a `withRagIngestion` scoped
helper so try/catch/end is automatic.

```ts
import { withRagIngestion } from '@mastra/core/observability';

await withRagIngestion(
  {
    mastra,
    name: 'docs ingestion',
    attributes: { vectorStore: 'pgvector', indexName: 'docs' },
  },
  async (observabilityContext) => {
    const chunks = await doc.chunk({ observabilityContext });
    const { embeddings } = await embed(chunks, { observabilityContext });
    await vectorStore.upsert({
      indexName: 'docs',
      vectors: embeddings,
      observabilityContext,
    });
    return { chunkCount: chunks.length };
  },
);
```

`withRagIngestion` internally calls `getOrCreateSpan`, runs the callback,
attaches the return value as the span's `output`, and routes thrown errors
to `span.error(...)`. Users who want manual control still have:

```ts
import { getOrCreateSpan, SpanType } from '@mastra/core/observability';

const { span, observabilityContext } = getOrCreateSpan({
  type: SpanType.RAG_INGESTION,
  name: 'docs ingestion',
  // ...
  mastra,
});
```

Either way the user only ever passes `observabilityContext` downstream — never
pulls a `tracingContext` field out by hand.

Query path is automatic — agents using `createVectorQueryTool` get
`RAG_EMBEDDING` + `RAG_VECTOR_OPERATION` (+ optional `RAG_ACTION` rerank)
children under the existing `TOOL_CALL` span with no user changes.

## Out of scope / follow-ups

- Per-store native tracing (e.g. pgvector EXPLAIN). The base
  `RAG_VECTOR_OPERATION` span captures latency + topK; deeper store-specific
  attributes can land per store later.
- Token-level streaming embeddings.
- Auto-hooking `MDocument` so any chunk call without an
  `observabilityContext` implicitly starts a `RAG_INGESTION`. Keep opt-in
  initially to avoid surprise root spans in unrelated user code.
- Promoting any `RAG_ACTION` variant to its own `SpanType` if UI surfaces
  end up needing it.

## Test plan

- Unit: span creation/attribute defaults in `tracing.test.ts`.
- Integration: `packages/rag` tests that exercise `vectorQuerySearch`,
  `rerank`, and `GraphRAG.query` under a fake exporter and assert the child
  span tree shape and `action` / `operation` attribute discriminators.
- Ingestion: a test that uses `withRagIngestion`, runs chunk → embed →
  upsert against an in-memory vector store, and asserts the recorded tree
  contains exactly the expected child types and attributes.

## Docs

- Update `docs/` RAG section with an observability subsection (follow
  `docs/AGENTS.md`).
- Add the new span types to the observability reference page.

## Changeset

Minor changeset against `@mastra/core` and `@mastra/rag` (and any vector
store base package touched). Follow `.mastracode/commands/changeset.md`.
