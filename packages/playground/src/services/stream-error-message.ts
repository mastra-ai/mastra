import type { MastraUIMessage } from '@mastra/react';

type StreamErrorChunk = {
  runId?: string;
  payload?: {
    error?: unknown;
  };
};

type FinishChunkLike = {
  type?: string;
  runId?: string;
  payload?: {
    stepResult?: {
      reason?: unknown;
    };
  };
};

const MAX_STEPS_FINISH_REASON = 'tool-calls';

export const getMaxStepsErrorText = (maxSteps?: number) => {
  const limit = typeof maxSteps === 'number' ? ` (${maxSteps})` : '';
  return `Agent stopped because it reached maxSteps${limit} while tool calls were still pending. Increase maxSteps in advanced settings and try again.`;
};

export const getFinishReason = (chunk: FinishChunkLike) => {
  if (chunk.type !== 'finish') return undefined;

  const reason = chunk.payload?.stepResult?.reason;
  return typeof reason === 'string' ? reason : undefined;
};

export const isMaxStepsFinishChunk = (chunk: FinishChunkLike) => getFinishReason(chunk) === MAX_STEPS_FINISH_REASON;

/**
 * Build a `MastraUIMessage` representing a stream `error` chunk so it can be
 * rendered by `error-aware-text`. Prefer the human-readable `message` field on
 * the error payload when present, falling back to a JSON dump so we never
 * silently swallow an error.
 */
export const buildStreamErrorMessage = (chunk: StreamErrorChunk): MastraUIMessage => {
  const errorValue = chunk.payload?.error;
  let text: string;
  if (typeof errorValue === 'string') {
    text = errorValue;
  } else if (
    errorValue &&
    typeof errorValue === 'object' &&
    typeof (errorValue as { message?: unknown }).message === 'string'
  ) {
    text = (errorValue as { message: string }).message;
  } else {
    text = JSON.stringify(errorValue ?? 'Unknown error');
  }
  return {
    id: `error-${chunk.runId ?? 'unknown'}-${Date.now()}`,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    metadata: { status: 'error' },
  } as MastraUIMessage;
};

export const buildMaxStepsStreamErrorMessage = (chunk: FinishChunkLike, maxSteps?: number) =>
  buildStreamErrorMessage({
    runId: chunk.runId,
    payload: { error: getMaxStepsErrorText(maxSteps) },
  });
