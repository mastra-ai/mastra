import type { JSONSchema7, Schema } from '@internal/ai-sdk-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import { isStandardSchemaWithJSON } from '../../schema/schema';
import type { StandardSchemaWithJSON } from '../../schema/schema';
import { standardSchemaToJSONSchema } from '../../schema/standard-schema';

export type PartialSchemaOutput<OUTPUT = undefined> = OUTPUT extends undefined ? undefined : Partial<OUTPUT>;

/**
 * @deprecated Use StandardSchemaWithJSON from '../../schema/schema' instead
 */
export type OutputSchema<OBJECT = any> =
  | z4.ZodType<OBJECT, any>
  | z3.Schema<OBJECT, z3.ZodTypeDef, any>
  | Schema<OBJECT>
  | JSONSchema7
  | undefined;

/**
 * @deprecated Use StandardSchemaWithJSON from '../../schema/schema' instead
 * Legacy type for schema validation - accepts both Zod v3 and v4 schemas
 */
export type SchemaWithValidation<T = any> = z4.ZodType<T, any> | z3.ZodType<T, z3.ZodTypeDef, any>;

/**
 * @deprecated Use InferPublicSchema or InferStandardSchemaOutput from '../../schema/schema' instead
 * Infer the output type from a schema
 */
export type InferSchemaOutput<T> =
  T extends z4.ZodType<infer O, any>
    ? O
    : T extends z3.ZodType<infer O, z3.ZodTypeDef, any>
      ? O
      : T extends Schema<infer O>
        ? O
        : unknown;

/**
 * @deprecated Use PublicSchema from '../../schema/schema' instead
 */
export type InferZodLikeSchema<T> =
  T extends z4.ZodType<infer O, any> ? O : T extends z3.ZodType<infer O, z3.ZodTypeDef, any> ? O : unknown;

export type ZodLikePartialSchema<T = any> = (
  | z4.core.$ZodType<Partial<T>, any> // Zod v4 partial schema
  | z3.ZodType<Partial<T>, z3.ZodTypeDef, any> // Zod v3 partial schema
) & {
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

    // Ensure additionalProperties is set to false for OpenAI strict mode
    // OpenAI requires this at the root level for structured outputs
    if (jsonSchema.type === 'object' && !('additionalProperties' in jsonSchema)) {
      jsonSchema.additionalProperties = false;
    }

    return jsonSchema;
  }

  return undefined;
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
