import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import { getCachedModel, warmupFastEmbedModels, type FastEmbedModelType } from './model-cache.js';

export {
  EmbeddingModel,
  FlagEmbedding,
  SparseTextEmbedding,
  SparseEmbeddingModel,
  ExecutionProvider,
} from './fastembed.js';
export type { SparseVector, InitOptions, InitSparseOptions } from './fastembed.js';

export type { EmbeddingModelV4 } from '@ai-sdk/provider';

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

  return {
    embeddings: allResults,
  };
}

// E5 models are asymmetric: queries and passages must be embedded with different prefixes.
async function generatePrefixedEmbeddings(
  values: string[],
  modelType: FastEmbedModelType,
  prefix: 'query' | 'passage',
) {
  return generateEmbeddings(
    values.map(value => `${prefix}: ${value}`),
    modelType,
  );
}

function createModel(
  modelId: string,
  embed: (values: string[]) => Promise<{ embeddings: number[][] }>,
): EmbeddingModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'fastembed',
    modelId,
    maxEmbeddingsPerCall: 256,
    supportsParallelCalls: true,
    async doEmbed({ values }) {
      const result = await embed(values);
      return { ...result, warnings: [] };
    },
  };
}

const small = createModel('bge-small-en-v1.5', values => generateEmbeddings(values, 'BGESmallENV15'));

export const fastembed: EmbeddingModelV4 & {
  small: EmbeddingModelV4;
  base: EmbeddingModelV4;
  multilingualE5LargeQuery: EmbeddingModelV4;
  multilingualE5LargePassage: EmbeddingModelV4;
} = Object.assign(
  createModel('bge-small-en-v1.5', values => generateEmbeddings(values, 'BGESmallENV15')),
  {
    small,
    base: createModel('bge-base-en-v1.5', values => generateEmbeddings(values, 'BGEBaseENV15')),
    multilingualE5LargeQuery: createModel('multilingual-e5-large-query', values =>
      generatePrefixedEmbeddings(values, 'MLE5Large', 'query'),
    ),
    multilingualE5LargePassage: createModel('multilingual-e5-large-passage', values =>
      generatePrefixedEmbeddings(values, 'MLE5Large', 'passage'),
    ),
  },
);
