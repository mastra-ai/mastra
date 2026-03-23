import type { JSONSchema7, Schema } from '@internal/ai-sdk-v5';
import type { z } from 'zod/v4';
import type { StandardSchemaWithJSON } from '../../schema';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';

export type PartialSchemaOutput<OUTPUT = undefined> = OUTPUT extends undefined ? undefined : Partial<OUTPUT>;

/**
 * @deprecated Use StandardSchemaWithJSON from '../../schema' instead
 */
export type OutputSchema<OBJECT = any> = z.ZodType<OBJECT, any> | Schema<OBJECT> | JSONSchema7 | undefined;

/**
 * @deprecated Use StandardSchemaWithJSON from '../../schema' instead
 * Legacy type for schema validation.
 */
export type SchemaWithValidation<T = any> = z.ZodType<T, any>;

/**
 * @deprecated Use InferPublicSchema or InferStandardSchemaOutput from '../../schema' instead
 * Infer the output type from a schema
 */
export type InferSchemaOutput<T> = T extends z.ZodType<infer O, any> ? O : T extends Schema<infer O> ? O : unknown;

/**
 * @deprecated Use PublicSchema from '../../schema' instead
 */
export type InferZodLikeSchema<T> = T extends z.ZodType<infer O, any> ? O : unknown;

export type ZodLikePartialSchema<T = any> = z.core.$ZodType<Partial<T>, any> & {
  safeParse(value: unknown): { success: boolean; data?: Partial<T>; error?: any };
};

export function asJsonSchema(schema: StandardSchemaWithJSON | undefined): JSONSchema7 | undefined {
  if (!schema) {
    return undefined;
  }

  // Handle StandardSchemaWithJSON
  if (isStandardSchemaWithJSON(schema)) {
    // Use 'input' IO mode to get the schema BEFORE transforms are applied
    // This is critical for OpenAI compat transforms that add .transform()
    // which can't be properly represented in JSON Schema
    //
    // Use 'draft-07' target for maximum compatibility with LLM providers
    const jsonSchema = standardSchemaToJSONSchema(schema, { io: 'input', target: 'draft-07' });

    return jsonSchema;
  }

  return schema;
}

export function getTransformedSchema<OUTPUT = undefined>(schema?: StandardSchemaWithJSON<OUTPUT>) {
  const jsonSchema = asJsonSchema(schema);

  if (!jsonSchema) {
    return undefined;
  }

  const { $schema, ...itemSchema } = jsonSchema;
  if (itemSchema.type === 'array') {
    const innerElement = itemSchema.items;
    const arrayOutputSchema: JSONSchema7 = {
      $schema: $schema,
      type: 'object',
      properties: {
        elements: { type: 'array', items: innerElement },
      },
      required: ['elements'],
      additionalProperties: false,
    };

    return {
      jsonSchema: arrayOutputSchema,
      outputFormat: 'array',
    };
  }

  // Handle enum schemas - wrap in object like AI SDK does
  if (itemSchema.enum && Array.isArray(itemSchema.enum)) {
    const enumOutputSchema: JSONSchema7 = {
      $schema: $schema,
      type: 'object',
      properties: {
        result: { type: itemSchema.type || 'string', enum: itemSchema.enum },
      },
      required: ['result'],
      additionalProperties: false,
    };

    return {
      jsonSchema: enumOutputSchema,
      outputFormat: 'enum',
    };
  }

  return {
    jsonSchema: jsonSchema,
    outputFormat: jsonSchema.type, // 'object'
  };
}

export function getResponseFormat(schema?: StandardSchemaWithJSON):
  | {
      type: 'text';
    }
  | {
      type: 'json';
      /**
       * JSON schema that the generated output should conform to.
       */
      schema?: JSONSchema7;
    } {
  if (schema) {
    const transformedSchema = getTransformedSchema(schema);
    return {
      type: 'json',
      schema: transformedSchema?.jsonSchema,
    };
  }

  // response format 'text' for everything else
  return {
    type: 'text',
  };
}
