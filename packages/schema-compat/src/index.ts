// Schema compatibility base class
export { SchemaCompatLayer } from './schema-compatibility';

// V3 functions and types
export * as v3 from './schema-compatibility-v3';

// V4 functions and types
export * as v4 from './schema-compatibility-v4';

// Utility functions
export { convertZodSchemaToAISDKSchema, applyCompatLayer, convertSchemaToZod, isZodType } from './utils';

// Provider compatibility implementations
export { AnthropicSchemaCompatLayer } from './provider-compats/anthropic';
export { DeepSeekSchemaCompatLayer } from './provider-compats/deepseek';
export { GoogleSchemaCompatLayer } from './provider-compats/google';
export { MetaSchemaCompatLayer } from './provider-compats/meta';
export { OpenAISchemaCompatLayer } from './provider-compats/openai';
export { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';

export { type ModelInformation } from './types';
export { type JSONSchema7, type Schema, jsonSchema } from './json-schema';

// Re-export zodTypes for v3 compatibility
export {
  ALL_STRING_CHECKS,
  ALL_NUMBER_CHECKS,
  ALL_ARRAY_CHECKS,
  UNSUPPORTED_ZOD_TYPES,
  SUPPORTED_ZOD_TYPES,
  ALL_ZOD_TYPES,
  type StringCheckType,
  type NumberCheckType,
  type ArrayCheckType,
  type UnsupportedZodType,
  type SupportedZodType,
  type AllZodType,
  type ZodShape,
  type ShapeKey,
  type ShapeValue,
} from './zodTypes';
