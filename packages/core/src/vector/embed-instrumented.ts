/**
 * Instrumented embedding helpers for RAG ingestion.
 *
 * Wraps the raw AI SDK `embed` functions with `RAG_EMBEDDING` child spans
 * carrying `mode: 'ingest'`. This is the ingestion counterpart of the
 * query-path embedding instrumented inside `vectorQuerySearch`.
 *
 * Accepts an optional `observabilityContext`; no-ops when absent.
 */

import type { ObservabilityContext } from '../observability';
import { SpanType } from '../observability';
import { embedV1, embedV2, embedV3 } from './embed';
import type { MastraEmbeddingModel, MastraEmbeddingOptions } from './vector';

export interface EmbedForIngestionParams {
  /** The embedding model to use */
  model: MastraEmbeddingModel<string>;
  /** Array of text values to embed */
  values: string[];
  /** Optional embedding options (maxRetries, providerOptions, etc.) */
  options?: MastraEmbeddingOptions;
  /** Observability context for tracing. When absent, no spans are emitted. */
  observabilityContext?: ObservabilityContext;
}

export interface EmbedForIngestionResult {
  /** The computed embedding vectors, one per input value */
  embeddings: number[][];
}

/**
 * Embed an array of texts for ingestion, optionally emitting a
 * `RAG_EMBEDDING` span with `mode: 'ingest'`.
 *
 * This mirrors the embedding logic in `vectorQuerySearch` but handles
 * batch inputs and tags spans as ingestion rather than query.
 */
export async function embedForIngestion({
  model,
  values,
  options,
  observabilityContext,
}: EmbedForIngestionParams): Promise<EmbedForIngestionResult> {
  const parentSpan = observabilityContext?.tracingContext?.currentSpan;

  const embedSpan = parentSpan?.createChildSpan({
    type: SpanType.RAG_EMBEDDING,
    name: 'rag embed: ingest',
    input: { count: values.length },
    attributes: {
      mode: 'ingest',
      model: (model as any)?.modelId,
      provider: (model as any)?.provider,
      inputCount: values.length,
    },
  });

  try {
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const value of values) {
      let result;
      if (model.specificationVersion === 'v3') {
        result = await embedV3({
          model: model,
          value,
          maxRetries: options?.maxRetries,
          ...(options?.providerOptions && {
            providerOptions: options.providerOptions as Parameters<typeof embedV3>[0]['providerOptions'],
          }),
        });
      } else if (model.specificationVersion === 'v2') {
        result = await embedV2({
          model: model,
          value,
          maxRetries: options?.maxRetries,
          ...(options?.providerOptions && {
            providerOptions: options.providerOptions as Parameters<typeof embedV2>[0]['providerOptions'],
          }),
        });
      } else {
        result = await embedV1({
          value,
          model: model,
          maxRetries: options?.maxRetries,
        });
      }

      embeddings.push(result.embedding);
      const usage = (result as any)?.usage;
      if (usage) {
        totalTokens += usage.tokens ?? usage.promptTokens ?? usage.inputTokens ?? 0;
      }
    }

    const dimensions = embeddings[0]?.length;
    embedSpan?.end({
      attributes: {
        dimensions,
        ...(totalTokens > 0 && {
          usage: { inputTokens: totalTokens },
        }),
      },
      output: { vectorCount: embeddings.length, dimensions },
    });

    return { embeddings };
  } catch (err) {
    embedSpan?.error({ error: err as Error, endSpan: true });
    throw err;
  }
}
