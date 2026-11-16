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
    output?: {
      steps?: unknown;
    };
  };
};

const MAX_STEPS_FINISH_REASON = 'tool-calls';

const isRetryStep = (step: unknown) =>
  typeof step === 'object' && step !== null && 'finishReason' in step && step.finishReason === 'retry';

/**
 * The steps a run spent from its maxSteps budget. A processor retry re-runs its
 * step, so core's step limit does not count it, and neither does this.
 */
const countBudgetedSteps = (steps: unknown) =>
  Array.isArray(steps) ? steps.filter(step => !isRetryStep(step)).length : undefined;

const getMaxStepsErrorText = (maxSteps?: number) => {
  const limit = typeof maxSteps === 'number' ? ` (${maxSteps})` : '';
  return `Agent stopped because it reached maxSteps${limit} while tool calls were still pending. Increase maxSteps in advanced settings and try again.`;
};

const getFinishReason = (chunk: FinishChunkLike) => {
  if (chunk.type !== 'finish') return undefined;

  const reason = chunk.payload?.stepResult?.reason;
  return typeof reason === 'string' ? reason : undefined;
};

/**
 * True when a run stopped because it used its whole step budget while the model
 * still wanted to call tools. A `'tool-calls'` finish reason alone only says the
 * last step called a tool: a `stopWhen` match or a client tool ends a run the
 * same way (#29612). So the run must also have used every step in `maxSteps`.
 * Without a known limit there is nothing to compare against, so no warning.
 */
export const isMaxStepsFinishChunk = ({
  chunk,
  maxSteps,
}: {
  chunk: FinishChunkLike;
  maxSteps: number | undefined;
}) => {
  if (getFinishReason(chunk) !== MAX_STEPS_FINISH_REASON) return false;
  if (typeof maxSteps !== 'number' || maxSteps < 1) return false;
  const usedSteps = countBudgetedSteps(chunk.payload?.output?.steps);
  return usedSteps !== undefined && usedSteps >= maxSteps;
};

/**
 * Build a `MastraDBMessage` representing a stream `error` chunk so it can be
 * rendered by `error-aware-text`. Prefer the human-readable `message` field on
 * the error payload when present, falling back to a JSON dump so we never
 * silently swallow an error.
 */
export const buildStreamErrorMessage = (chunk: StreamErrorChunk): MastraDBMessage => {
  const errorValue = chunk.payload?.error;
  let text: string;
  if (typeof errorValue === 'string') {
    text = errorValue;
  } else if (errorValue instanceof Error) {
    text = errorValue.message;
  } else if (
    errorValue &&
    typeof errorValue === 'object' &&
    typeof (errorValue as { message?: unknown }).message === 'string'
  ) {
    text = (errorValue as { message: string }).message;
  } else if (errorValue == null) {
    text = 'Unknown error';
  } else {
    try {
      text = JSON.stringify(errorValue) ?? String(errorValue);
    } catch {
      try {
        text = String(errorValue);
      } catch {
        text = 'Unknown error';
      }
    }
  }
  return {
    id: `error-${chunk.runId ?? 'unknown'}-${Date.now()}`,
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { status: 'error' },
    },
  };
};

export const buildMaxStepsStreamErrorMessage = (chunk: FinishChunkLike, maxSteps?: number) =>
  buildStreamErrorMessage({
    runId: chunk.runId,
    payload: { error: getMaxStepsErrorText(maxSteps) },
  });
