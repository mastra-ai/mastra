// Re-export everything from @mastra/schema-compat for backwards compatibility
export type {
  PublicSchema,
  InferPublicSchema,
  StandardSchemaWithJSON,
  InferStandardSchemaOutput,
} from '@mastra/schema-compat';

export { toStandardSchema, isStandardSchemaWithJSON } from '@mastra/schema-compat';
