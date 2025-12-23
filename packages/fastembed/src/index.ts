import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { customProvider as customProviderV2 } from '@internal/ai-sdk-v5';
import { customProvider as customProviderLegacy } from '@internal/ai-sdk-v4';
import type { EmbeddingModelV3 } from '@internal/ai-v6';
import { customProvider as customProviderV3 } from '@internal/ai-v6';
import { FlagEmbedding, EmbeddingModel } from 'fastembed';

export type { EmbeddingModel as EmbeddingModelV1 } from '@internal/ai-sdk-v4';
export type { EmbeddingModel as EmbeddingModelV2 } from '@internal/ai-sdk-v5';
export type { EmbeddingModel as EmbeddingModelV3 } from '@internal/ai-v6';

async function getModelCachePath() {
  const cachePath = path.join(os.homedir(), '.cache', 'mastra', 'fastembed-models');
  await fsp.mkdir(cachePath, { recursive: true });
  return cachePath;
}

// Shared function to generate embeddings using fastembed
async function generateEmbeddings(values: string[], modelType: 'BGESmallENV15' | 'BGEBaseENV15') {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel[modelType],
    cacheDir: await getModelCachePath(),
  });

  // model.embed() returns an AsyncGenerator that processes texts in batches (default size 256)
  const embeddings = model.embed(values);

  const allResults = [];
  for await (const result of embeddings) {
    // result is an array of embeddings, one for each text in the batch
    // We convert each Float32Array embedding to a regular number array
    allResults.push(...result.map(embedding => Array.from(embedding)));
  }

  if (allResults.length === 0) throw new Error('No embeddings generated');

  return {
    embeddings: allResults,
  };
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
        const result = await generateEmbeddings(values, 'BGESmallENV15');
        return { ...result, warnings: [] };
      },
    },
    'bge-base-en-v1.5': {
      specificationVersion: 'v3',
      provider: 'fastembed',
      modelId: 'bge-base-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      async doEmbed({ values }) {
        const result = await generateEmbeddings(values, 'BGEBaseENV15');
        return { ...result, warnings: [] };
      },
    },
  },
});

export const fastembed: EmbeddingModelV3 = Object.assign(fastEmbedProviderV3.embeddingModel(`bge-small-en-v1.5`), {
  small: fastEmbedProviderV3.embeddingModel(`bge-small-en-v1.5`),
  base: fastEmbedProviderV3.embeddingModel(`bge-base-en-v1.5`),
  smallV2: fastEmbedProviderV2.textEmbeddingModel(`bge-small-en-v1.5`),
  baseV2: fastEmbedProviderV2.textEmbeddingModel(`bge-base-en-v1.5`),
  smallLegacy: fastEmbedLegacyProvider.textEmbeddingModel(`bge-small-en-v1.5`),
  baseLegacy: fastEmbedLegacyProvider.textEmbeddingModel(`bge-base-en-v1.5`),
});
