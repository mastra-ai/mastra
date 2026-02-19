// Re-export everything from @mastra/schema-compat for backwards compatibility
export type {
  StandardSchemaWithJSON,
  StandardSchemaWithJSONProps,
  InferInput,
  InferOutput,
  StandardSchemaIssue,
} from '@mastra/schema-compat';

export {
  toStandardSchema,
  isStandardSchema,
  isStandardJSONSchema,
  isStandardSchemaWithJSON,
  standardSchemaToJSONSchema,
  JSON_SCHEMA_LIBRARY_OPTIONS,
} from '@mastra/schema-compat';
