import { customProvider } from 'ai';
import { esClient } from './elasticsearch-client';

/**
 * Configuration for Elasticsearch Inference Service embedder
 */
export interface ElasticsearchInferenceConfig {
  /**
   * The inference ID configured in Elasticsearch (e.g., 'jina-embeddings-v3')
   * This should match an inference endpoint you've created in Elasticsearch or which is already available off-the-shelf.
   */
  inferenceId: string;

  /**
   * Maximum number of texts to embed in a single batch
   * @default 16
   */
  maxBatchSize?: number;
}

/**
 * Creates an Elastic Inference Service embedder that uses EIS for generating embeddings.
 *
 * Prerequisites:
 *
 *    Create an inference endpoint using EIS (Elastic Inference Service) or use one of the preconfigured ones:
 *    ```
 *    PUT _inference/text_embedding/jina-embeddings-v3
 *    {
 *      "service": "elastic",
 *      "service_settings": {
 *        "model_id": ".jina-embeddings-v3"
 *      }
 *    }
 *    ```
 *
 * @param config Configuration for the Elasticsearch inference embedder
 * @returns An AI SDK compatible embedding model
 */
export function createElasticsearchInferenceEmbedder(
  config: ElasticsearchInferenceConfig
) {
  const maxBatchSize = config.maxBatchSize ?? 16;

  const provider = customProvider({
    textEmbeddingModels: {
      [config.inferenceId]: {
        specificationVersion: 'v3',
        provider: 'elastic',
        modelId: config.inferenceId,
        maxEmbeddingsPerCall: maxBatchSize,
        supportsParallelCalls: true,
        async doEmbed({ values }) {
          try {
            const response = await esClient.inference.inference({
              inference_id: config.inferenceId,
              input: values,
              task_type: 'text_embedding',
            });

            let embeddings: number[][];

            if (response.text_embedding) {
              embeddings = response.text_embedding.map((result: any) => {
                return result.embedding;
              });
            } else {
              throw new Error(
                `Unexpected response format from Elasticsearch Inference API. Response: ${JSON.stringify(response)}`
              );
            }

            return {
              embeddings,
              warnings: [],
            };
          } catch (error) {
            throw new Error(
              `Elasticsearch Inference API error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        },
      },
    },
  });

  return provider.textEmbeddingModel(config.inferenceId);
}
