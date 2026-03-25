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
 * @returns Configured embedding model or model string
 */
export function createEmbedder() {
  const config = getEmbedderConfig();

  switch (config.provider) {
    case 'elastic': {
      if (!config.elasticInferenceId) {
        throw new Error(
          'ELASTIC_INFERENCE_ID is required when EMBEDDER_PROVIDER=elastic.\n' +
          'Example: ELASTIC_INFERENCE_ID=jina-embeddings-v5-text-small.'
        );
      }

      console.log(`[Embedder] Using Elastic Inference Service: ${config.elasticInferenceId}`);
      return createElasticsearchInferenceEmbedder({
        inferenceId: config.elasticInferenceId,
      });
    }

    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          'OPENAI_API_KEY is required when EMBEDDER_PROVIDER=openai.\n' +
          'Set OPENAI_API_KEY in your .env file.'
        );
      }

      console.log(`[Embedder] Using OpenAI: ${config.openaiModel}`);
      return config.openaiModel!;
    }

    default: {
      throw new Error(
        `Unknown embedder provider: ${config.provider}.\n` +
        'Supported providers: openai, elastic\n' +
        'Set EMBEDDER_PROVIDER=openai or EMBEDDER_PROVIDER=elastic\n'
      );
    }
  }
}
