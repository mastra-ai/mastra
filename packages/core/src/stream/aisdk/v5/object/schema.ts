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

export function getResponseFormat({
  output,
  schema,
  schemaName,
  schemaDescription,
}: ObjectOptions): NonNullable<LanguageModelV2CallOptions['responseFormat']> {
  // response format type is 'json' when 'output' is 'object', 'array', or 'no-schema' OR if schema is provided
  if ((!output && schema) || output === 'object' || output === 'array' || output === 'no-schema') {
    return {
      type: 'json',
      schema: getOutputSchema({ schema, output }),
      name: schemaName,
      description: schemaDescription,
    };
  }
  // response format 'text' for everything else (regular text gen, tool calls, etc)
  return {
    type: 'text',
  };
}
