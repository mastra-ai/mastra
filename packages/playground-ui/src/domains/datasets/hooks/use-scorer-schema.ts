import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for ScorerRunInputForAgent type.
 * Used for scorer calibration datasets - the input field structure.
 */
const SCORER_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Scorer input for agent-type scorer calibration (ScorerRunInputForAgent)',
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
 * JSON Schema for ScorerRunOutputForAgent type.
 * Used for scorer calibration datasets - the expectedOutput field structure.
 * Represents MastraDBMessage[] (the expected agent response).
 */
const SCORER_OUTPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'array',
  description: 'Scorer output for agent-type scorer calibration (ScorerRunOutputForAgent = MastraDBMessage[])',
  items: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
      content: { type: 'string' },
    },
    required: ['role', 'content'],
  },
};

/**
 * Hook that returns scorer schemas for agent-type scorer calibration datasets.
 * - inputSchema: ScorerRunInputForAgent structure
 * - outputSchema: ScorerRunOutputForAgent (MastraDBMessage[])
 *
 * Note: expectedOutput maps to groundTruth in ScorerRun which has no defined schema.
 * The outputSchema here is for the "output" field used in scorer calibration,
 * which represents the expected agent response for comparison.
 */
export function useScorerSchema() {
  return {
    inputSchema: SCORER_INPUT_SCHEMA,
    outputSchema: SCORER_OUTPUT_SCHEMA,
    isLoading: false,
    error: null as Error | null,
  };
}
