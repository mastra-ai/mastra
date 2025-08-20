import type { LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { asSchema } from 'ai-v5';
import type { JSONSchema7 } from 'ai-v5';

export function getOutputSchema({ schema }: { schema?: Parameters<typeof asSchema>[0] }) {
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

export function getResponseFormat({
  schema,
}:
  | {
      schema?: Parameters<typeof asSchema>[0];
    }
  | undefined = {}): NonNullable<LanguageModelV2CallOptions['responseFormat']> {
  if (schema) {
    const outputSchema = getOutputSchema({ schema });
    return {
      type: 'json',
      schema: outputSchema?.jsonSchema,
    };
  }

  // response format 'text' for everything else (regular text gen, tool calls, etc)
  return {
    type: 'text',
  };
}
