import { createElasticsearchInferenceEmbedder } from './elasticsearch-embedder';

/**
 * Supported embedder providers
 */
export type EmbedderProvider = 'openai' | 'elastic';

/**
 * Configuration for the embedder based on environment variables
 */
export interface EmbedderConfig {
  provider: EmbedderProvider;
  // OpenAI specific
  openaiModel?: string;
  // Elasticsearch Inference specific
  elasticInferenceId?: string;
}

/**
 * Reads embedder configuration from environment variables
 */
export function getEmbedderConfig(): EmbedderConfig {
  const provider = (process.env.EMBEDDER_PROVIDER || 'openai') as EmbedderProvider;

  return {
    provider,
    openaiModel: process.env.OPENAI_EMBEDDING_MODEL || 'openai/text-embedding-3-small',
    elasticInferenceId: process.env.ELASTIC_INFERENCE_ID || 'jina-embeddings-v5-text-small',
  };
}

/**
 * Creates an embedder based on the configuration
 *
 * Supports two providers:
 * - 'openai': Uses OpenAI's embedding models (requires OPENAI_API_KEY)
 * - 'elastic': Uses Elastic Inference Service with models like Jina
 *
 * @returns Configured embedding model, model string, or null if no valid configuration
 */
export function createEmbedder() {
  if (!process.env.EMBEDDER_PROVIDER) {
    console.log('[Embedder] No embedder configured. Memory and semantic recall disabled.');
    console.log('[Embedder] To enable memory, set EMBEDDER_PROVIDER=openai or EMBEDDER_PROVIDER=elastic and configure an embedding model');
    return null;
  }

  const config = getEmbedderConfig();

  switch (config.provider) {
    case 'elastic': {
      if (!config.elasticInferenceId) {
        console.warn(
          '[Embedder] ELASTIC_INFERENCE_ID is required when EMBEDDER_PROVIDER=elastic.\n' +
          '[Embedder] Example: ELASTIC_INFERENCE_ID=jina-embeddings-v5-text-small.\n' +
          '[Embedder] Memory disabled.'
        );
        return null;
      }

      console.log(`[Embedder] Using Elastic Inference Service: ${config.elasticInferenceId}`);
      return createElasticsearchInferenceEmbedder({
        inferenceId: config.elasticInferenceId,
      });
    }

    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        console.warn(
          '[Embedder] OPENAI_API_KEY is required when EMBEDDER_PROVIDER=openai.\n' +
          '[Embedder] Set OPENAI_API_KEY in your .env file.\n' +
          '[Embedder] Memory disabled.'
        );
        return null;
      }

      console.log(`[Embedder] Using OpenAI: ${config.openaiModel}`);
      return config.openaiModel!;
    }

    default: {
      console.warn(
        `[Embedder] Unknown embedder provider: ${config.provider}.\n` +
        '[Embedder] Supported providers: openai, elastic\n' +
        '[Embedder] Memory disabled.'
      );
      return null;
    }
  }
}
