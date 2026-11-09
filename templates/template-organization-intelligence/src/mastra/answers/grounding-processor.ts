import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import type { ChunkType } from '@mastra/core/stream';
import type { SourceIndex } from '../workspaces/source-index.js';
import { clarificationAnswer, clarificationResponse } from './clarification.js';
import { evidencePrompt } from './evidence.js';
import { recordAnswerObservation, recordAnswerTelemetry } from './observation.js';
import { presentedResult, textDelta } from './presentation.js';
import type { QueryContextualizer } from './query-context.js';
import { prepareGrounding } from './retrieval.js';
import type { GroundingOptions, OrganizationAnswer, ProcessorState } from './schema.js';
import { safeOperationalResult, validatedResult } from './validation.js';

export type { GroundingOptions } from './schema.js';

type FinalPart = Extract<ChunkType, { type: 'finish' | 'error' }>;

function finalAnswer(part: FinalPart, state: ProcessorState): OrganizationAnswer {
  if (state.clarification) return clarificationAnswer(state);
  if (part.type === 'error') {
    state.validationFailure = 'provider_failure';
    return safeOperationalResult(state);
  }
  try {
    return validatedResult(state, part.payload.stepResult.reason);
  } catch {
    return safeOperationalResult(state);
  }
}

async function finalizeAnswer(index: SourceIndex, options: GroundingOptions, part: FinalPart, state: ProcessorState) {
  state.emittedResult = true;
  const result = finalAnswer(part, state);
  state.answerResult = result;
  recordAnswerObservation(result, state, options);
  const payload = part.payload as { output?: { usage?: unknown }; usage?: unknown };
  await recordAnswerTelemetry(
    index,
    options,
    result,
    state,
    payload.output?.usage ?? payload.usage,
    part.type === 'error',
  );
  return textDelta(part, presentedResult(result, state));
}

const sanitizeErrors: NonNullable<OutputProcessor['processOutputStep']> = ({ messages }) =>
  messages.map(message => {
    if (message.role !== 'assistant') return message;
    return {
      ...message,
      content: {
        ...message.content,
        parts: message.content.parts.map(part =>
          part.type === 'error'
            ? { ...part, error: { name: 'Error', message: 'The answer could not be validated.' } }
            : part,
        ),
      },
    };
  });

export function createGroundingProcessor(
  index: SourceIndex,
  options: GroundingOptions = {},
  contextualize?: QueryContextualizer,
) {
  const processor: InputProcessor & OutputProcessor = {
    id: 'organization-grounding',
    processInput: async ({ messages, state, systemMessages, abortSignal }) => {
      const processorState = state as ProcessorState;
      await prepareGrounding(index, messages, processorState, contextualize, abortSignal);
      return {
        messages,
        systemMessages: [
          ...systemMessages,
          {
            role: 'system',
            content: evidencePrompt(
              processorState.evidence ?? [],
              processorState.promptSourceStatus ?? [],
              processorState.searchQuery,
            ),
          },
        ],
      };
    },
    processLLMRequest: ({ state }) => {
      const processorState = state as ProcessorState;
      if (processorState.clarification) return { response: clarificationResponse(processorState) };
    },
    processInputStep: async ({ modelSettings }) => ({
      modelSettings: { ...modelSettings, maxOutputTokens: 4_096 },
    }),
    processOutputStream: async ({ part, state }) => {
      const processorState = state as ProcessorState;
      if (processorState.emittedResult) return null;
      if (part.type === 'text-delta') processorState.rawText = (processorState.rawText ?? '') + part.payload.text;
      if (part.type !== 'finish' && part.type !== 'error') return null;
      return finalizeAnswer(index, options, part, processorState);
    },
    processOutputStep: sanitizeErrors,
    processOutputResult: async ({ messages, result, state }) => {
      const processorState = state as ProcessorState;
      if (processorState.answerResult)
        await recordAnswerTelemetry(index, options, processorState.answerResult, processorState, result.usage, true);
      return messages;
    },
  };
  return processor;
}
