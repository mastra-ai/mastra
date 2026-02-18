import type { JSONSchema7 } from 'json-schema';

/**
 * JSON Schema for MastraDBMessage
 */
const MESSAGE_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
    content: { type: 'string' },
  },
  required: ['role', 'content'],
};

/**
 * JSON Schema for ScorerRunInputForAgent (used as scoringInput.input)
 */
const SCORER_RUN_INPUT_FOR_AGENT: JSONSchema7 = {
  type: 'object',
  description: 'ScorerRunInputForAgent',
  properties: {
    inputMessages: {
      type: 'array',
      description: 'User input messages (MastraDBMessage[])',
      items: MESSAGE_SCHEMA,
    },
    rememberedMessages: {
      type: 'array',
      description: 'Messages from memory (MastraDBMessage[])',
      items: MESSAGE_SCHEMA,
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
 * JSON Schema for ScorerRunOutputForAgent (used as scoringInput.output)
 * MastraDBMessage[]
 */
const SCORER_RUN_OUTPUT_FOR_AGENT: JSONSchema7 = {
  type: 'array',
  description: 'ScorerRunOutputForAgent (MastraDBMessage[])',
  items: MESSAGE_SCHEMA,
};

/**
 * JSON Schema for scorer input (scoringInputSchema) for agent-type scorers.
 * - input: ScorerRunInputForAgent
 * - output: ScorerRunOutputForAgent
 */
const SCORER_AGENT_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Scorer input for agent-type scorers (scoringInputSchema)',
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID (optional)',
    },
    input: SCORER_RUN_INPUT_FOR_AGENT,
    output: SCORER_RUN_OUTPUT_FOR_AGENT,
    additionalContext: {
      type: 'object',
      description: 'Additional context (optional)',
      additionalProperties: true,
    },
    requestContext: {
      type: 'object',
      description: 'Request context (optional)',
      additionalProperties: true,
    },
  },
  required: [],
};

/**
 * JSON Schema for scorer input (scoringInputSchema) for custom scorers.
 * - input: any
 * - output: any
 */
const SCORER_CUSTOM_INPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Scorer input for custom scorers (scoringInputSchema)',
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID (optional)',
    },
    input: {
      description: 'Input to the entity being scored (any)',
    },
    output: {
      description: 'Output from the entity being scored (any)',
    },
    additionalContext: {
      type: 'object',
      description: 'Additional context (optional)',
      additionalProperties: true,
    },
    requestContext: {
      type: 'object',
      description: 'Request context (optional)',
      additionalProperties: true,
    },
  },
  required: [],
};

/**
 * JSON Schema for scorer output (score and reason from scoreRowDataSchema).
 */
const SCORER_OUTPUT_SCHEMA: JSONSchema7 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description: 'Scorer result (score and reason)',
  properties: {
    score: {
      type: 'number',
      description: 'Numeric score value',
    },
    reason: {
      type: 'string',
      description: 'Explanation for the score',
    },
  },
  required: ['score'],
};

/**
 * Hook that returns scorer input/output schemas.
 * - agentInputSchema: for agent-type scorers (ScorerRunInputForAgent/ScorerRunOutputForAgent)
 * - customInputSchema: for custom scorers (input/output as any)
 * - outputSchema: score + reason from scoreRowDataSchema
 */
export function useScorerSchema() {
  return {
    agentInputSchema: SCORER_AGENT_INPUT_SCHEMA,
    customInputSchema: SCORER_CUSTOM_INPUT_SCHEMA,
    outputSchema: SCORER_OUTPUT_SCHEMA,
    isLoading: false,
    error: null as Error | null,
  };
}
