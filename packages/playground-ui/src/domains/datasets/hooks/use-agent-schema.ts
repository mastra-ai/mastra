import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for ScorerRunInputForAgent type.
 * All agents share the same input schema structure.
 */
const AGENT_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Agent input for scorer evaluation (ScorerRunInputForAgent)',
  properties: {
    inputMessages: {
      type: 'array',
      description: 'User input messages (MastraDBMessage[])',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
          content: { type: 'string' },
        },
        required: ['role', 'content'],
      },
    },
    rememberedMessages: {
      type: 'array',
      description: 'Messages from memory (MastraDBMessage[])',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
          content: { type: 'string' },
        },
        required: ['role', 'content'],
      },
    },
    systemMessages: {
      type: 'array',
      description: 'System messages (CoreMessage[])',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['system'] },
          content: { type: 'string' },
        },
        required: ['role', 'content'],
      },
    },
    taggedSystemMessages: {
      type: 'object',
      description: 'Tagged system messages (Record<string, CoreSystemMessage[]>)',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['system'] },
            content: { type: 'string' },
          },
          required: ['role', 'content'],
        },
      },
    },
  },
  required: ['inputMessages', 'rememberedMessages', 'systemMessages', 'taggedSystemMessages'],
};

/**
 * Hook that returns the agent input schema.
 * All agents share the same schema (ScorerRunInputForAgent) - no agentId needed.
 * Agents don't have a defined output schema for scorer evaluation.
 */
export function useAgentSchema() {
  return {
    inputSchema: AGENT_INPUT_SCHEMA,
    outputSchema: null as JSONSchema7 | null,
    isLoading: false,
    error: null as Error | null,
  };
}
