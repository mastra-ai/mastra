import type { MastraDBMessage } from '@mastra/core/agent/message-list';

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

const getMaxStepsErrorText = (maxSteps?: number) => {
  const limit = typeof maxSteps === 'number' ? ` (${maxSteps})` : '';
  return `Agent stopped because it reached maxSteps${limit} while tool calls were still pending. Increase maxSteps in advanced settings and try again.`;
};

const getFinishReason = (chunk: FinishChunkLike) => {
  if (chunk.type !== 'finish') return undefined;

  const reason = chunk.payload?.stepResult?.reason;
  // The type check only narrows: the sole caller compares the result against a
  // string literal, which a non-string reason fails either way.
  // Stryker disable next-line ConditionalExpression
  return typeof reason === 'string' ? reason : undefined;
};

export const isMaxStepsFinishChunk = (chunk: FinishChunkLike) => getFinishReason(chunk) === MAX_STEPS_FINISH_REASON;

/**
 * Build a `MastraDBMessage` representing a stream `error` chunk so it can be
 * rendered by `error-aware-text`. Prefer the human-readable `message` field on
 * the error payload when present, falling back to a JSON dump so we never
 * silently swallow an error.
 */
const getErrorText = (errorValue: unknown): string => {
  if (typeof errorValue === 'string') return errorValue;

  // One read covers both an `Error` and any object carrying a readable
  // `message`: a primitive answers `undefined` here, so it needs no guard of
  // its own, and an `Error` reaches this the same way a plain object does.
  const message = (errorValue as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string') return message;

  if (errorValue == null) return 'Unknown error';

  try {
    return JSON.stringify(errorValue) ?? String(errorValue);
  } catch {
    try {
      return String(errorValue);
    } catch {
      return 'Unknown error';
    }
  }
};

export const buildStreamErrorMessage = (chunk: StreamErrorChunk): MastraDBMessage => {
  const text = getErrorText(chunk.payload?.error);
  return {
    id: `error-${chunk.runId ?? 'unknown'}-${Date.now()}`,
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { status: 'error' },
    },
  } as MastraDBMessage;
};

export const buildMaxStepsStreamErrorMessage = (chunk: FinishChunkLike, maxSteps?: number) =>
  buildStreamErrorMessage({
    runId: chunk.runId,
    payload: { error: getMaxStepsErrorText(maxSteps) },
  });
