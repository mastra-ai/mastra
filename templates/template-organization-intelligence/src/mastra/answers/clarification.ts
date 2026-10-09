import { randomUUID } from 'node:crypto';
import type { CachedLLMStepResponse } from '@mastra/core/processors';
import type { OrganizationAnswer, ProcessorState } from './schema.js';

export function clarificationAnswer(state: ProcessorState): OrganizationAnswer {
  return {
    status: 'clarification_required',
    answer: state.clarification!,
    citations: [],
    sourceStatus: state.sourceStatus ?? [],
    metadata: {
      correlationId: state.correlationId ?? randomUUID(),
      retrievalMs: state.retrievalMs ?? 0,
      sourceIds: [],
    },
  };
}

/** Use the processor response hook so clarification follows normal streaming and memory persistence. */
export function clarificationResponse(state: ProcessorState): CachedLLMStepResponse {
  return {
    chunks: [
      { type: 'text-start', payload: { id: 'clarification' } },
      { type: 'text-delta', payload: { id: 'clarification', text: JSON.stringify(clarificationAnswer(state)) } },
      { type: 'text-end', payload: { id: 'clarification' } },
      {
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      },
    ],
  };
}
