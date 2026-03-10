// Re-export everything from @mastra/schema-compat for backwards compatibility
export type {
  PublicSchema,
  InferPublicSchema,
  StandardSchemaWithJSON,
  InferStandardSchemaOutput,
  StandardSchemaIssue,
} from '@mastra/schema-compat/schema';

export { toStandardSchema, isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
