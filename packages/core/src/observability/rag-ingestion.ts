/**
 * RAG ingestion helpers.
 *
 * Provides a thin wrapper around `getOrCreateSpan` for starting a
 * `RAG_INGESTION` root span without reaching into observability internals.
 *
 * Two surfaces:
 *  - `startRagIngestion(...)`  — manual: returns `{ span, observabilityContext }`,
 *    caller is responsible for `.end()` / `.error()`.
 *  - `withRagIngestion(opts, fn)` — scoped: runs `fn(observabilityContext)`,
 *    automatically attaches the return value as the span's `output` and
 *    routes thrown errors to `span.error(...)`.
 *
 * ## Observability data
 *
 * Mastra emits raw span data (start/end timestamps, attributes, input,
 * output) — exporters and downstream consumers do their own aggregation.
 * The shapes below are designed to make the common derivations cheap:
 *
 *  - **Duration**: every span has start/end, so per-operation latency
 *    falls out for free.
 *  - **Embedding cost**: `RAG_EMBEDDING` spans (and only `RAG_EMBEDDING`
 *    spans) expose `attributes.usage` using the same `UsageStats` shape as
 *    `MODEL_GENERATION`, so any existing LLM cost-extraction pipeline that
 *    parses `usage.inputTokens` handles embeddings uniformly. Cost
 *    dimensions are `{model, provider, mode}` (mode is `'ingest'` or
 *    `'query'`). Token counts are deliberately NOT duplicated on the
 *    `RAG_INGESTION` root — aggregating at the root would double-count
 *    when summing child spans. Mirrors how `AGENT_RUN` does not carry
 *    aggregated `MODEL_GENERATION` usage.
 *  - **Vector store throughput**: `RAG_VECTOR_OPERATION` spans carry
 *    `{operation, store, indexName}` as attributes; result counts live on
 *    `output` (e.g. `output.returned`, `output.vectorCount`).
 *  - **Ingestion roll-ups**: `RAG_INGESTION` (root) carries
 *    `{vectorStore, indexName, embeddingModel, embeddingProvider}` as
 *    attributes and aggregate `usage` summed across child embed calls.
 */

import { createObservabilityContext } from './context-factory';
import { EntityType, SpanType } from './types';
import type { GetOrCreateSpanOptions, ObservabilityContext, RagIngestionAttributes, Span } from './types';
import { getOrCreateSpan } from './utils';

export type StartRagIngestionOptions = Omit<GetOrCreateSpanOptions<SpanType.RAG_INGESTION>, 'type' | 'entityType'>;

export interface StartRagIngestionResult {
  /**
   * The RAG_INGESTION span. May be undefined if observability is disabled
   * or no Mastra instance / parent span is available.
   */
  span: Span<SpanType.RAG_INGESTION> | undefined;
  /**
   * Full observability context to thread through chunk / embed / upsert calls.
   * Always defined; falls back to no-op when `span` is undefined.
   */
  observabilityContext: ObservabilityContext;
}

/**
 * Start a `RAG_INGESTION` root span. Caller is responsible for closing it
 * via `result.span?.end(...)` or `result.span?.error(...)`.
 *
 * Prefer `withRagIngestion` for the common try/catch/end flow.
 *
 * @example
 * ```ts
 * const { span, observabilityContext } = startRagIngestion({
 *   mastra,
 *   name: 'docs ingestion',
 *   attributes: { vectorStore: 'pgvector', indexName: 'docs' },
 * });
 * try {
 *   const chunks = await doc.chunk({ observabilityContext });
 *   // ...
 *   span?.end({ output: { chunkCount: chunks.length } });
 * } catch (err) {
 *   span?.error({ error: err as Error });
 *   throw err;
 * }
 * ```
 */
export function startRagIngestion(options: StartRagIngestionOptions): StartRagIngestionResult {
  const span = getOrCreateSpan<SpanType.RAG_INGESTION>({
    ...options,
    entityType: EntityType.RAG_INGESTION,
    type: SpanType.RAG_INGESTION,
  });

  const observabilityContext = createObservabilityContext(span ? { currentSpan: span } : undefined);

  return { span, observabilityContext };
}

/**
 * Run an async function inside a `RAG_INGESTION` root span.
 *
 * The callback receives an `ObservabilityContext` to thread into chunk,
 * embed, and vector-store calls. The return value is attached to the span
 * as `output`. Thrown errors are recorded via `span.error(...)` and
 * re-thrown.
 *
 * @example
 * ```ts
 * await withRagIngestion(
 *   {
 *     mastra,
 *     name: 'docs ingestion',
 *     attributes: { vectorStore: 'pgvector', indexName: 'docs' },
 *   },
 *   async (observabilityContext) => {
 *     const chunks = await doc.chunk({ observabilityContext });
 *     const { embeddings } = await embed(chunks, { observabilityContext });
 *     await vectorStore.upsert({
 *       indexName: 'docs',
 *       vectors: embeddings,
 *       observabilityContext,
 *     });
 *     return { chunkCount: chunks.length };
 *   },
 * );
 * ```
 */
export async function withRagIngestion<T>(
  options: StartRagIngestionOptions,
  fn: (observabilityContext: ObservabilityContext) => Promise<T>,
): Promise<T> {
  const { span, observabilityContext } = startRagIngestion(options);

  try {
    const result = await fn(observabilityContext);
    span?.end({ output: result as any });
    return result;
  } catch (err) {
    span?.error({ error: err as Error, endSpan: true });
    throw err;
  }
}

export type { RagIngestionAttributes };
