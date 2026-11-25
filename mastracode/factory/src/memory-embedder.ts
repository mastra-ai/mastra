import type { MemoryEmbedder } from '@mastra/code-sdk/agents/memory';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';

/**
 * Builds the deployment's recall embedder once, at construction. A router string is turned into a
 * model here so a missing provider key fails the boot instead of the first recall.
 */
export function resolveFactoryEmbedder(config: {
  vector?: MastraVector;
  embedder?: MemoryEmbedder;
}): MastraEmbeddingModel<string> | undefined {
  if (config.embedder === undefined) return undefined;
  if (!config.vector) {
    throw new Error(
      "MastraFactory: 'embedder' needs 'vector'. Recall vectors are stored in the vector store, so pass one " +
        "(e.g. new PgVector({ connectionString }) from '@mastra/pg').",
    );
  }
  if (typeof config.embedder !== 'string') return config.embedder;
  try {
    return new ModelRouterEmbeddingModel(config.embedder);
  } catch (error) {
    throw new Error(
      `MastraFactory: could not build the embedder '${config.embedder}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
