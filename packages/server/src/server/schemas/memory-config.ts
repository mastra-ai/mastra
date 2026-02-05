import z from 'zod';

/**
 * Shared memory configuration schemas for agent storage
 * These schemas match the SerializedMemoryConfig type from @mastra/core
 */

/**
 * Semantic recall configuration for vector-based memory retrieval
 */
export const semanticRecallSchema = z.object({
  topK: z.number().describe('Number of semantically similar messages to retrieve'),
  messageRange: z
    .union([
      z.number(),
      z.object({
        before: z.number(),
        after: z.number(),
      }),
    ])
    .describe('Amount of surrounding context to include with each retrieved message'),
  scope: z.enum(['thread', 'resource']).optional().describe('Scope for semantic search queries'),
  threshold: z.number().min(0).max(1).optional().describe('Minimum similarity score threshold'),
  indexName: z.string().optional().describe('Index name for the vector store'),
});

/**
 * Title generation configuration
 * When stored, the model is serialized as a ModelRouterModelId string (provider/model-name format)
 */
export const titleGenerationSchema = z.union([
  z.boolean(),
  z.object({
    model: z.string().describe('Model ID in format provider/model-name (ModelRouterModelId)'),
    instructions: z.string().optional().describe('Custom instructions for title generation'),
  }),
]);

/**
 * Serialized memory configuration matching SerializedMemoryConfig from @mastra/core
 *
 * Note: workingMemory and threads are omitted as they are not part of SerializedMemoryConfig
 * @see packages/core/src/memory/types.ts
 */
export const serializedMemoryConfigSchema = z
  .object({
    vector: z
      .union([z.string(), z.literal(false)])
      .optional()
      .describe('Vector database identifier or false to disable'),
    options: z
      .object({
        readOnly: z.boolean().optional(),
        lastMessages: z.union([z.number(), z.literal(false)]).optional(),
        semanticRecall: z.union([z.boolean(), semanticRecallSchema]).optional(),
        generateTitle: titleGenerationSchema.optional(),
      })
      .optional()
      .describe('Memory behavior configuration, excluding workingMemory and threads'),
    embedder: z
      .string()
      .optional()
      .describe('Embedding model ID in the format "provider/model" (e.g., "openai/text-embedding-3-small")'),
    embedderOptions: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Options to pass to the embedder, omitting telemetry'),
  })
  .refine(
    data => {
      // If semanticRecall is enabled (true or object), both vector and embedder are required
      const semanticRecall = data.options?.semanticRecall;
      const semanticRecallEnabled =
        semanticRecall === true || (typeof semanticRecall === 'object' && semanticRecall !== null);

      if (semanticRecallEnabled) {
        // vector must be a string (not false or undefined)
        const hasVector = typeof data.vector === 'string' && data.vector.length > 0;
        // embedder must be defined
        const hasEmbedder = typeof data.embedder === 'string' && data.embedder.length > 0;

        return hasVector && hasEmbedder;
      }
      return true;
    },
    {
      message: 'Semantic recall requires both vector and embedder to be configured',
      path: ['options', 'semanticRecall'],
    },
  );
