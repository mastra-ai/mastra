import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ChunkType } from '@mastra/core/stream';

type StreamErrorChunk = {
  runId?: string;
  payload?: {
    error?: unknown;
  };
};

type FinishChunk = Extract<ChunkType, { type: 'finish' }>;

const getMaxStepsErrorText = (maxSteps?: number) => {
  const limit = typeof maxSteps === 'number' ? ` (${maxSteps})` : '';
  return `Agent stopped because it reached maxSteps${limit} while tool calls were still pending. Increase maxSteps in advanced settings and try again.`;
};

type FinishStep = NonNullable<FinishChunk['payload']['output']['steps']>[number];

/**
 * A retried step re-runs, so core's step limit does not count it. A processor
 * retry keeps its rejection as `tripwire.retry`, which the finish chunk carries
 * even where it leaves `finishReason` empty (core 1.83.0). Core also sends
 * `'retry'` as the finish reason, a value outside the AI SDK union the type
 * declares, so the reason is widened to a string to compare it.
 */
const isRetriedStep = (step: FinishStep) => {
  const finishReason: string | undefined = step.finishReason;
  return step.tripwire?.retry === true || finishReason === 'retry';
};

/**
 * A server on a @mastra/core that predates `stopCause` only says how many steps
 * the run took, and only on the caller's own stream: thread subscription copies
 * drop `steps`. Using every step is the best guess there, though a client tool
 * or hook stop on the last allowed step looks the same.
 */
const usedEveryStep = ({ chunk, maxSteps }: { chunk: FinishChunk; maxSteps: number | undefined }) => {
  const steps = chunk.payload.output?.steps;
  if (typeof maxSteps !== 'number' || maxSteps < 1 || !Array.isArray(steps)) return false;
  return steps.filter(step => !isRetriedStep(step)).length >= maxSteps;
};

/**
 * True when a run stopped because it used its whole step budget while the model
 * still wanted to call tools. A `'tool-calls'` finish reason alone only says the
 * last step called a tool: a `stopWhen` match, a client tool or an
 * `onIterationComplete` stop end a run the same way, even on the last allowed
 * step (#29612). Core reports why its loop stopped as `stopCause`, on both the
 * agent stream and thread subscription copies, so that decides.
 */
export const isMaxStepsFinishChunk = ({ chunk, maxSteps }: { chunk: ChunkType; maxSteps: number | undefined }) => {
  if (chunk.type !== 'finish' || chunk.payload.stepResult?.reason !== 'tool-calls') return false;
  const { stopCause } = chunk.payload;
  if (stopCause !== undefined) return stopCause === 'max_steps';
  return usedEveryStep({ chunk, maxSteps });
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

export const buildMaxStepsStreamErrorMessage = (chunk: Pick<ChunkType, 'runId'>, maxSteps?: number) =>
  buildStreamErrorMessage({
    runId: chunk.runId,
    payload: { error: getMaxStepsErrorText(maxSteps) },
  });
