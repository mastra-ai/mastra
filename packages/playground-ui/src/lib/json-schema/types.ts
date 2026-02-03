/**
 * JSON Schema type primitives
 */
export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/**
 * JSON Schema property definition
 * Unified type that supports all use cases across the codebase
 * Note: `type` accepts string for flexibility with dynamic schema generation
 */
export interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
  enum?: unknown[];
  default?: unknown;
}

/**
 * JSON Schema definition for rule building and general use
 */
export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * JSON Schema output format (for form builders that produce schemas)
 */
export interface JsonSchemaOutput {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}
