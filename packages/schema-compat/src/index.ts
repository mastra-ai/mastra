// Schema compatibility base class and related types
export {
  SchemaCompatLayer as SchemaCompatLayerV3,
  ALL_STRING_CHECKS,
  ALL_NUMBER_CHECKS,
  ALL_ARRAY_CHECKS,
  UNSUPPORTED_ZOD_TYPES,
  SUPPORTED_ZOD_TYPES,
  ALL_ZOD_TYPES,
  // Types
  type StringCheckType,
  type NumberCheckType,
  type ArrayCheckType,
  type UnsupportedZodType,
  type SupportedZodType,
  type AllZodType,
  type ZodShape,
  type ShapeKey,
  type ShapeValue,
  // Re-usable type predicates
  isOptional,
  isObj,
  isArr,
  isUnion,
  isString,
  isNumber,
} from './schema-compatibility-v3';
export { SchemaCompatLayer as SchemaCompatLayerV4 } from './schema-compatibility-v4';
export { SchemaCompatLayer } from './schema-compatibility';

// Utility functions
export { convertZodSchemaToAISDKSchema, applyCompatLayer, convertSchemaToZod, isZodType } from './utils';

// Standard Schema compatibility utilities
export { extractZodSchema, applyOpenAICompatTransforms, applyOpenAICompatToTools } from './standard-schema-compat';

// Provider compatibility implementations
export { AnthropicSchemaCompatLayer } from './provider-compats/anthropic';
export { DeepSeekSchemaCompatLayer } from './provider-compats/deepseek';
export { GoogleSchemaCompatLayer } from './provider-compats/google';
export { MetaSchemaCompatLayer } from './provider-compats/meta';
export { OpenAISchemaCompatLayer } from './provider-compats/openai';
export { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';

export { type ModelInformation } from './types';
export { type JSONSchema7, type Schema, jsonSchema } from './json-schema';

// Re-export standard schema types and functions from the schema.ts subpath
// These are also available directly from the main entry for convenience
export type { PublicSchema, InferPublicSchema } from './schema.types';

export type {
  StandardSchemaWithJSON,
  StandardSchemaWithJSONProps,
  InferInput,
  InferOutput,
  StandardSchemaIssue,
} from './standard-schema/standard-schema.types';

export {
  toStandardSchema,
  isStandardSchema,
  isStandardJSONSchema,
  isStandardSchemaWithJSON,
  standardSchemaToJSONSchema,
  JSON_SCHEMA_LIBRARY_OPTIONS,
} from './standard-schema/standard-schema';
