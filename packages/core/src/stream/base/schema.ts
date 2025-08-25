import { asSchema } from 'ai-v5';
import type { JSONSchema7, Schema } from 'ai-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';

export type PartialSchemaOutput<OUTPUT extends OutputSchema = undefined> = OUTPUT extends undefined
  ? undefined
  : Partial<InferSchemaOutput<OUTPUT>>;

export type InferSchemaOutput<OUTPUT extends OutputSchema> = OUTPUT extends undefined
  ? undefined
  : OUTPUT extends z4.ZodType<infer OBJECT, any>
    ? OBJECT // Zod v4
    : OUTPUT extends z3.Schema<infer OBJECT, z3.ZodTypeDef, any>
      ? OBJECT // Zod v3
      : OUTPUT extends Schema<infer OBJECT>
        ? OBJECT // JSON Schema (AI SDK's Schema type)
        : unknown; // Fallback

export type OutputSchema<OBJECT = any> =
  | z4.ZodType<OBJECT, any>
  | z3.Schema<OBJECT, z3.ZodTypeDef, any>
  | Schema<OBJECT>
  | undefined;

export type ZodLikePartialSchema<T = any> = (
  | z4.core.$ZodType<Partial<T>, any> // Zod v4 partial schema
  | z3.ZodType<Partial<T>, z3.ZodTypeDef, any> // Zod v3 partial schema
) & {
  safeParse(value: unknown): { success: boolean; data?: Partial<T>; error?: any };
};

export function getTransformedSchema<OUTPUT extends OutputSchema = undefined>(schema?: OUTPUT) {
  const jsonSchema = schema ? asSchema(schema).jsonSchema : undefined;
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

export function getResponseFormat(schema?: OutputSchema | undefined):
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
