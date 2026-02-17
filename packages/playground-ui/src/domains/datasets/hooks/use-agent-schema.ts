import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for MessageListInput type.
 * Can be a string, array of strings, message object, or array of message objects.
 */
const AGENT_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Agent input (MessageListInput) - string, string[], message, or message[]',
  oneOf: [
    { type: 'string', description: 'Simple text message' },
    {
      type: 'array',
      description: 'Array of messages',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        ],
      },
    },
    {
      type: 'object',
      description: 'Single message object',
      properties: {
        role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
        content: { type: 'string' },
      },
      required: ['role', 'content'],
    },
  ],
};

/**
 * JSON Schema for agent output (text response).
 */
const AGENT_OUTPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'string',
  description: 'Agent text response',
};

/**
 * Hook that returns the agent input/output schemas.
 * - inputSchema: MessageListInput (what you pass to agent.generate())
 * - outputSchema: string (text response)
 */
export function useAgentSchema() {
  return {
    inputSchema: AGENT_INPUT_SCHEMA,
    outputSchema: AGENT_OUTPUT_SCHEMA,
    isLoading: false,
    error: null as Error | null,
  };
}
