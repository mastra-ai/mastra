import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';

// Re-export everything from @mastra/schema-compat for backwards compatibility
export type {
  PublicSchema,
  InferPublicSchema,
  StandardSchemaWithJSON,
  InferStandardSchemaOutput,
  StandardSchemaIssue,
} from '@mastra/schema-compat/schema';

export type ZodSchema = ZodSchemaV3 | ZodTypeV4;
export type ZodType = ZodSchema;

export { toStandardSchema, isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
