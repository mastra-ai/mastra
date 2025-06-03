import type { EmbeddingModel } from 'ai';

/**
 * A mock embedder for worker threads that satisfies the Memory constructor's embedder requirement
 * but doesn't perform actual embeddings. The main thread's Memory instance will handle real embeddings.
 */
export const mockEmbedder: EmbeddingModel<string> = {
  specificationVersion: 'v1', // Or appropriate version
  provider: 'mock-provider',
  modelId: 'mock-embedder-model',
  maxEmbeddingsPerCall: 128, // A reasonable default
  supportsParallelCalls: true,

  // `dimensions` and `maxEmbeddingsPerCall` might not be standard on the base EmbeddingModel.
  // They are often part of a specific provider's configuration or model details.
  // The Memory class primarily needs the `doEmbed` functionality.
  async doEmbed({ values }: { values: string[] }) {
    // Return dummy embeddings (array of number arrays) of a consistent dimension (e.g., 384)
    const dimension = 384; // This is an implicit dimension, not part of the model spec here
    const embeddings: number[][] = values.map(() => Array(dimension).fill(0.1));
    return {
      embeddings,
    };
  },
};
