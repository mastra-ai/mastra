import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for MessageListInput type.
 * Can be a string, array of strings, message object, or array of message objects.
 */
/**
 * Content can be a plain string or an array of content parts (text, image, tool-call, etc.).
 * Matches AI SDK CoreMessage / ModelMessage content field.
 */
const messageContentSchema: JSONSchema7 = {
  anyOf: [
    { type: 'string' },
    {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  ],
};

const messageObjectSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
    content: messageContentSchema,
  },
  required: ['role', 'content'],
};

const AGENT_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Agent message input (MessageListInput)',
  anyOf: [
    { type: 'string', description: 'Simple text message' },
    {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of text messages',
    },
    {
      ...messageObjectSchema,
      description: 'Single message object',
    },
    {
      type: 'array',
      description: 'Array of message objects',
      items: messageObjectSchema,
    },
  ],
};

/**
 * JSON Schema for agent output — matches the experiment executor's trimmedOutput shape.
 * All properties optional so partial ground truth (e.g. just text) is valid.
 */
const AGENT_OUTPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Agent generate() output',
  properties: {
    text: { type: 'string', description: 'Text response' },
    object: { description: 'Structured output (if any)' },
    toolCalls: {
      type: 'array',
      description: 'Tool calls made by the agent',
      items: { type: 'object', additionalProperties: true },
    },
    toolResults: {
      type: 'array',
      description: 'Tool execution results',
      items: { type: 'object', additionalProperties: true },
    },
    sources: {
      type: 'array',
      description: 'Sources referenced',
      items: { type: 'object', additionalProperties: true },
    },
    files: {
      type: 'array',
      description: 'Files generated',
      items: { type: 'object', additionalProperties: true },
    },
    usage: {
      type: 'object',
      description: 'Token usage',
      properties: {
        promptTokens: { type: 'number' },
        completionTokens: { type: 'number' },
        totalTokens: { type: 'number' },
      },
    },
    reasoningText: { type: 'string', description: 'Reasoning text (if any)' },
  },
};

/**
 * Hook that returns the agent input/output schemas.
 * - inputSchema: MessageListInput (what you pass to agent.generate())
 * - outputSchema: agent generate() trimmed output (text, object, toolCalls, etc.)
 */
export function useAgentSchema() {
  return {
    inputSchema: AGENT_INPUT_SCHEMA,
    outputSchema: AGENT_OUTPUT_SCHEMA,
    isLoading: false,
    error: null as Error | null,
  };
}
