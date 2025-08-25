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
export { convertZodSchemaToAISDKSchema, applyCompatLayer, convertSchemaToZod } from './utils';

// Provider compatibility implementations
export { AnthropicSchemaCompatLayer } from './provider-compats/anthropic';
export { DeepSeekSchemaCompatLayer } from './provider-compats/deepseek';
export { GoogleSchemaCompatLayer } from './provider-compats/google';
export { MetaSchemaCompatLayer } from './provider-compats/meta';
export { OpenAISchemaCompatLayer } from './provider-compats/openai';
export { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
