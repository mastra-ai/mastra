// Re-export everything from @mastra/schema-compat for backwards compatibility
export type {
  PublicSchema,
  InferPublicSchema,
  StandardSchemaWithJSON,
  InferStandardSchemaOutput,
} from '@mastra/schema-compat/schema';

export { toStandardSchema, isStandardSchemaWithJSON } from '@mastra/schema-compat/schema';
