import { experimental_customProvider } from 'ai';
// @ts-ignore no types for this package
import node_modulesPath from 'node_modules-path';
import path from 'path';

let cachedPath: false | string = false;
function getModelCachePath() {
  if (cachedPath) return cachedPath;

  // TODO: we can set this somewhere for cloud to drop models there in advance
  // for now it's in node_modules/.fastembed-model-cache
  const firstNodeModules = node_modulesPath().split('node_modules')[0];
  cachedPath = path.join(firstNodeModules, 'node_modules', '.fastembed-model-cache');

  return cachedPath;
}

// Shared function to generate embeddings using fastembed
async function generateEmbeddings(values: string[], modelType: 'BGESmallENV15' | 'BGEBaseENV15') {
  try {
    // Dynamically import fastembed only when this function is called
    // this is to avoid importing fastembed in runtimes that don't support its native bindings
    const fastEmbedImportPath = 'fastembed?d=' + Date.now(); // +? date to prevent esbuild from seeing this as statically analyzable and bundling this as a regular import.
    const { EmbeddingModel, FlagEmbedding } = await import(fastEmbedImportPath.split(`?`)[0]!); // remove the date to prevent module not found errors in cloud

    const model = await FlagEmbedding.init({
      model: EmbeddingModel[modelType],
      cacheDir: getModelCachePath(),
    });

    // model.embed() returns an AsyncGenerator that processes texts in batches (default size 256)
    const embeddings = await model.embed(values);

    const allResults = [];
    for await (const result of embeddings) {
      // result is an array of embeddings, one for each text in the batch
      // We convert each Float32Array embedding to a regular number array
      // @ts-ignore ? Date.now() import breaks types
      allResults.push(...result.map(embedding => Array.from(embedding)));
    }

    if (allResults.length === 0) throw new Error('No embeddings generated');

    return {
      embeddings: allResults,
    };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
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

export const localEmbedder = fastEmbedProvider.textEmbeddingModel;
