import type { JSONSchema7, Schema } from '@internal/ai-sdk-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
import type { ZodLikeSchema } from '../../types/zod-compat';

/**
 * Type alias for structured output schema types.
 * Can be undefined (no schema), or any valid output type.
 */
export type OutputSchema<OBJECT = any> =
  | z4.ZodType<OBJECT, any>
  | z3.Schema<OBJECT, z3.ZodTypeDef, any>
  | Schema<OBJECT>
  | JSONSchema7
  | undefined;

export type InferZodLikeSchema<T> = T extends { parse: (data: unknown) => infer U } ? U : any;
export type SchemaWithValidation<OBJECT = any> = ZodLikeSchema<OBJECT>;

export type ZodLikePartialSchema<T = any> = (
  | z4.core.$ZodType<Partial<T>, any> // Zod v4 partial schema
  | z3.ZodType<Partial<T>, z3.ZodTypeDef, any> // Zod v3 partial schema
) & {
  safeParse(value: unknown): { success: boolean; data?: Partial<T>; error?: any };
};

/**
 * Infers the output type from a schema.
 * Returns the schema type itself if defined, otherwise undefined.
 */
export type InferSchemaOutput<OUTPUT> = OUTPUT extends undefined ? undefined : OUTPUT;

export function toJSONSchema<OUTPUT>(schema: StandardSchema<OUTPUT>): JSONSchema7 {
  return schema['~standard'].jsonSchema.input({
    target: 'draft-07',
  });
}

export function getTransformedSchema(jsonSchema: JSONSchema7): {
  jsonSchema: JSONSchema7;
  outputFormat: 'array' | 'enum' | 'object';
} {
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
    outputFormat: 'object',
  };
}

export function getResponseFormat(schema?: JSONSchema7):
  | {
      type: 'text';
    }
  | {
      type: 'json';
      schema: JSONSchema7;
    } {
  if (schema) {
    const transformedSchema = getTransformedSchema(schema);
    return {
      type: 'json',
      schema: transformedSchema.jsonSchema,
    };
  }

  // response format 'text' for everything else
  return {
    type: 'text',
  };
}
