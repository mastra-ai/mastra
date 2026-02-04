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
export const serializedMemoryConfigSchema = z.object({
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
});
