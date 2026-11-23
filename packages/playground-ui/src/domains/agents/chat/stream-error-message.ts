import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ChunkType } from '@mastra/core/stream';

type StreamErrorChunk = {
  runId?: string;
  payload?: {
    error?: unknown;
  };
};

const getMaxStepsErrorText = (maxSteps?: number) => {
  const limit = typeof maxSteps === 'number' ? ` (${maxSteps})` : '';
  return `Agent stopped because it reached maxSteps${limit} while tool calls were still pending. Increase maxSteps in advanced settings and try again.`;
};

/**
 * True when a run stopped because it used its whole step budget while the model
 * still wanted to call tools. A `'tool-calls'` finish reason alone only says the
 * last step called a tool: a `stopWhen` match, a client tool or an
 * `onIterationComplete` stop end a run the same way, even on the last allowed
 * step (#29612). Core reports why its loop stopped as `stopCause`, on both the
 * agent stream and thread subscription copies. When `stopCause` is absent (for
 * example from an older `@mastra/core` server), do not infer exhaustion from
 * step count, because intentional boundary stops look identical.
 */
export const isMaxStepsFinishChunk = ({ chunk }: { chunk: ChunkType; maxSteps?: number | undefined }) => {
  if (chunk.type !== 'finish' || chunk.payload.stepResult?.reason !== 'tool-calls') return false;
  return chunk.payload.stopCause === 'max_steps';
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
