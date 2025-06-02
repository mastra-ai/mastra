import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { experimental_customProvider } from 'ai';
import { FlagEmbedding, EmbeddingModel } from 'fastembed';

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

const fastEmbedProvider = experimental_customProvider({
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

export const fastembed = Object.assign(fastEmbedProvider.textEmbeddingModel(`bge-small-en-v1.5`), {
  small: fastEmbedProvider.textEmbeddingModel(`bge-small-en-v1.5`),
  base: fastEmbedProvider.textEmbeddingModel(`bge-base-en-v1.5`),
});
