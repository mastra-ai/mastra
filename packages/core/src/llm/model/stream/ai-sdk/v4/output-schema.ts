import type {
  LanguageModelV1FunctionTool,
  LanguageModelV1ProviderDefinedTool,
  LanguageModelV1ToolChoice,
} from '@ai-sdk/provider';
import type { CoreMessage, LanguageModelV1CallOptions } from 'ai';
import { asSchema } from 'ai-v5';
import type { JSONSchema7 } from 'ai-v5';

type OutputMode = 'object' | 'array' | 'no-schema' | undefined;

export function getModeOption({
  mode: modeType,
  output,
  outputSchema,
  schemaName,
  schemaDescription,
  tools,
  toolChoice,
}: {
  mode?: 'regular' | 'object-json' | 'object-tool';
  output?: OutputMode;
  outputSchema?: JSONSchema7;
  schemaName?: string;
  schemaDescription?: string;
  tools?: (LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool)[] | undefined;
  toolChoice?: LanguageModelV1ToolChoice;
}): LanguageModelV1CallOptions['mode'] {
  let mode = modeType;
  // default to object-json for no-schema outputs
  if (!mode && output === 'no-schema') {
    mode = 'object-json';
  }

  if (mode === 'object-json') {
    return {
      type: 'object-json',
      schema: outputSchema,
      name: schemaName,
      description: schemaDescription,
    };
  } else if (mode === 'object-tool') {
    if (!outputSchema) {
      throw new Error('JSON schema is required for object-tool mode');
    }
    return {
      type: 'object-tool',
      tool: {
        type: 'function',
        name: schemaName ?? 'json',
        description: schemaDescription ?? 'Respond with a JSON object.',
        parameters: outputSchema,
      },
    };
  } else {
    return {
      type: 'regular',
      tools,
      toolChoice,
    };
  }
}

export function getOutputSchema({ schema, output }: { schema?: Parameters<typeof asSchema>[0]; output?: OutputMode }) {
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

/**
 * For models that don't support structured outputs,
 * inject the json schema as the first system message
 */
export function injectJsonInstructions({
  outputSchema,
  inputMessages,
}: {
  outputSchema?: JSONSchema7;
  inputMessages: CoreMessage[];
}) {
  if (outputSchema) {
    inputMessages.unshift({
      role: 'system',
      content: `JSON schema:\n${JSON.stringify(outputSchema)}\nYou MUST answer with a JSON object that matches the JSON schema above.`,
    });
  } else {
    // For no-schema mode, inject generic JSON instruction
    inputMessages.unshift({
      role: 'system',
      content: 'You MUST answer with JSON.',
    });
  }
}
