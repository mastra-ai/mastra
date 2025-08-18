import type { LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { asSchema } from 'ai-v5';
import type { JSONSchema7 } from 'ai-v5';
import type { ObjectOptions } from '../../../../loop/types';

type OutputMode = 'object' | 'array' | 'no-schema' | undefined;

function getOutputSchema({ schema, output }: { schema?: Parameters<typeof asSchema>[0]; output?: OutputMode }) {
  if (output === 'no-schema') {
    return undefined;
  }
  const jsonSchema = schema ? asSchema(schema).jsonSchema : undefined;
  if (!jsonSchema) {
    return undefined;
  }

  if (output === 'array') {
    const { $schema, ...itemSchema } = jsonSchema;
    const arrayOutputSchema: JSONSchema7 = {
      $schema: $schema,
      type: 'object',
      properties: {
        elements: { type: 'array', items: itemSchema },
      },
      required: ['elements'],
      additionalProperties: false,
    };
    return arrayOutputSchema;
  }

  return jsonSchema;
}

export function getResponseFormat(options: ObjectOptions): NonNullable<LanguageModelV2CallOptions['responseFormat']> {
  // response format type is 'json' when 'output' is 'object', 'array', or 'no-schema' OR if schema is provided
  if (
    (!options?.output && options?.schema) ||
    options?.output === 'object' ||
    options?.output === 'array' ||
    options?.output === 'no-schema'
  ) {
    return {
      type: 'json',
      schema: getOutputSchema({ schema: options?.schema, output: options?.output }),
      name: options?.schemaName,
      description: options?.schemaDescription,
    };
  }
  // response format 'text' for everything else (regular text gen, tool calls, etc)
  return {
    type: 'text',
  };
}
