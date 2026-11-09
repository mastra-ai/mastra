import { customProvider as customProviderV2 } from '@internal/ai-sdk-v5';
import { customProvider as customProviderLegacy } from '@internal/ai-sdk-v4';
import type { EmbeddingModelV3 } from '@internal/ai-v6';
import type { EmbeddingModel as EmbeddingModelV2 } from '@internal/ai-sdk-v5';
import type { EmbeddingModel as EmbeddingModelV1 } from '@internal/ai-sdk-v4';
import { customProvider as customProviderV3 } from '@internal/ai-v6';
import { getCachedModel, warmupFastEmbedModels, type FastEmbedModelType } from './model-cache.js';

export {
  EmbeddingModel,
  FlagEmbedding,
  SparseTextEmbedding,
  SparseEmbeddingModel,
  ExecutionProvider,
} from './fastembed.js';
export type { SparseVector, InitOptions, InitSparseOptions } from './fastembed.js';

export type { EmbeddingModel as EmbeddingModelV1 } from '@internal/ai-sdk-v4';
export type { EmbeddingModel as EmbeddingModelV2 } from '@internal/ai-sdk-v5';
export type { EmbeddingModel as EmbeddingModelV3 } from '@internal/ai-v6';

/**
 * Pre-download fastembed models without creating ONNX sessions.
 * Call this before running tests in parallel to avoid concurrent download races.
 */
export async function warmup() {
  await warmupFastEmbedModels();
}

// Shared function to generate embeddings using fastembed
async function generateEmbeddings(values: string[], modelType: FastEmbedModelType) {
  const model = await getCachedModel(modelType);

  // model.embed() returns an AsyncGenerator that processes texts in batches (default size 256)
  const embeddings = model.embed(values);

  const allResults = [];
  for await (const result of embeddings) {
    // result is an array of embeddings, one for each text in the batch
    // We convert each Float32Array embedding to a regular number array
    allResults.push(...result.map(embedding => Array.from(embedding)));
  }

  if (allResults.length === 0) throw new Error('No embeddings generated');
  if (allResults.length !== values.length) {
    throw new Error(`Expected ${values.length} embeddings but received ${allResults.length}`);
  }

  return {
    embeddings: allResults,
  };
}

// E5 models are asymmetric: queries and passages must be embedded with different prefixes.
function applyPrefix(values: string[], prefix?: 'query' | 'passage') {
  return prefix ? values.map(value => `${prefix}: ${value}`) : values;
}

// V3 models can report warnings, so surface inputs that the model's token window silently truncates.
async function generateEmbeddingsWithWarnings(
  values: string[],
  modelType: FastEmbedModelType,
  prefix?: 'query' | 'passage',
) {
  const inputs = applyPrefix(values, prefix);
  const result = await generateEmbeddings(inputs, modelType);
  const model = await getCachedModel(modelType);
  const { count, maxLength } = await model.countTruncated(inputs);
  const warnings =
    count > 0
      ? [
          {
            type: 'other' as const,
            message: `${count} of ${inputs.length} inputs exceed the model's ${maxLength}-token window and were truncated; text beyond it does not affect the embedding. Use smaller chunks to embed the full text.`,
          },
        ]
      : [];
  return { ...result, warnings };
}

// Legacy v1 provider for backwards compatibility
const fastEmbedLegacyProvider = customProviderLegacy({
  textEmbeddingModels: {
    'bge-small-en-v1.5': {
      specificationVersion: 'v1',
      provider: 'fastembed',
      modelId: 'bge-small-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddings(values, 'BGESmallENV15');
      },
    },
    'bge-base-en-v1.5': {
      specificationVersion: 'v1',
      provider: 'fastembed',
      modelId: 'bge-base-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddings(values, 'BGEBaseENV15');
      },
    },
  },
});

// V2 provider for AI SDK v5 compatibility
const fastEmbedProviderV2 = customProviderV2({
  textEmbeddingModels: {
    'bge-small-en-v1.5': {
      specificationVersion: 'v2',
      provider: 'fastembed',
      modelId: 'bge-small-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddings(values, 'BGESmallENV15');
      },
    },
    'bge-base-en-v1.5': {
      specificationVersion: 'v2',
      provider: 'fastembed',
      modelId: 'bge-base-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddings(values, 'BGEBaseENV15');
      },
    },
  },
});

// V3 provider for AI SDK v6 compatibility
const fastEmbedProviderV3 = customProviderV3({
  embeddingModels: {
    'bge-small-en-v1.5': {
      specificationVersion: 'v3',
      provider: 'fastembed',
      modelId: 'bge-small-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddingsWithWarnings(values, 'BGESmallENV15');
      },
    },
    'bge-base-en-v1.5': {
      specificationVersion: 'v3',
      provider: 'fastembed',
      modelId: 'bge-base-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddingsWithWarnings(values, 'BGEBaseENV15');
      },
    },
    'multilingual-e5-large-query': {
      specificationVersion: 'v3',
      provider: 'fastembed',
      modelId: 'multilingual-e5-large-query',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddingsWithWarnings(values, 'MLE5Large', 'query');
      },
    },
    'multilingual-e5-large-passage': {
      specificationVersion: 'v3',
      provider: 'fastembed',
      modelId: 'multilingual-e5-large-passage',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        return generateEmbeddingsWithWarnings(values, 'MLE5Large', 'passage');
      },
    },
  },
});

export const fastembed: EmbeddingModelV3 & {
  small: EmbeddingModelV3;
  base: EmbeddingModelV3;
  multilingualE5LargeQuery: EmbeddingModelV3;
  multilingualE5LargePassage: EmbeddingModelV3;
  smallV2: EmbeddingModelV2<string>;
  baseV2: EmbeddingModelV2<string>;
  smallLegacy: EmbeddingModelV1<string>;
  baseLegacy: EmbeddingModelV1<string>;
} = Object.assign(fastEmbedProviderV3.embeddingModel(`bge-small-en-v1.5`), {
  small: fastEmbedProviderV3.embeddingModel(`bge-small-en-v1.5`),
  base: fastEmbedProviderV3.embeddingModel(`bge-base-en-v1.5`),
  multilingualE5LargeQuery: fastEmbedProviderV3.embeddingModel(`multilingual-e5-large-query`),
  multilingualE5LargePassage: fastEmbedProviderV3.embeddingModel(`multilingual-e5-large-passage`),
  smallV2: fastEmbedProviderV2.textEmbeddingModel(`bge-small-en-v1.5`),
  baseV2: fastEmbedProviderV2.textEmbeddingModel(`bge-base-en-v1.5`),
  smallLegacy: fastEmbedLegacyProvider.textEmbeddingModel(`bge-small-en-v1.5`),
  baseLegacy: fastEmbedLegacyProvider.textEmbeddingModel(`bge-base-en-v1.5`),
});
