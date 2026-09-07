import { setImmediate } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { noopLogger } from '../../../logger/noop-logger';
import { ChunkFrom } from '../../../stream/types';
import type { ChunkType } from '../../../stream/types';
import {
  createDurableAgentStream,
  emitAbortEvent,
  emitChunkEvent,
  emitErrorEvent,
  emitFinishEvent,
} from '../stream-adapter';

it.each(['finish', 'throwing-callback', 'error', 'abort'] as const)(
  'preserves the terminal error contract: %s',
  async ending => {
    const pubsub = new EventEmitterPubSub();
    const onChunk = vi.fn(async () => {
      if (ending === 'throwing-callback') throw new Error('Callback failed');
    });
    const onError = vi.fn();
    const onAbort = vi.fn();
    const onFinish = vi.fn();
    const { output, ready, cleanup } = createDurableAgentStream({
      pubsub,
      runId: 'error-order',
      messageId: 'message',
      model: { modelId: 'mock', provider: 'mock', version: 'v2' },
      logger: noopLogger,
      onChunk,
      onError,
      onAbort,
      onFinish,
    });
    const chunks: ChunkType[] = [];
    const consuming = (async () => {
      for await (const chunk of output.fullStream) chunks.push(chunk);
    })();
    const original = { message: 'Original provider error', name: 'ProviderError', stack: 'original stack' };
    const chunk: ChunkType = {
      type: 'error',
      runId: 'error-order',
      from: ChunkFrom.AGENT,
      payload: { error: original },
    };
    try {
      await ready;
      await emitChunkEvent(pubsub, 'error-order', chunk);
      await setImmediate();
      expect(onChunk).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(chunks).toEqual([]);
      if (ending === 'abort') {
        await emitAbortEvent(pubsub, 'error-order', { text: '', steps: [] });
      } else if (ending === 'error') {
        const fatal = new Error('Workflow failed');
        fatal.name = 'WorkflowError';
        await emitErrorEvent(pubsub, 'error-order', fatal);
      } else {
        await emitFinishEvent(pubsub, 'error-order', {
          output: { text: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, steps: [] },
          stepResult: { reason: 'error', isContinued: false, warnings: [] },
        });
      }
      await consuming;
      await pubsub.flush();
      const errors = chunks.filter(chunk => chunk.type === 'error');
      if (ending === 'abort') {
        expect(errors).toHaveLength(0);
        expect(onError).not.toHaveBeenCalled();
        expect(onChunk).not.toHaveBeenCalled();
        expect(onAbort).toHaveBeenCalledTimes(1);
      } else if (ending === 'error') {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.payload.error).toMatchObject({ message: 'Workflow failed', name: 'WorkflowError' });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onChunk).not.toHaveBeenCalled();
        expect(onFinish).not.toHaveBeenCalled();
      } else {
        expect(errors).toEqual([chunk]);
        expect(onChunk).toHaveBeenCalledExactlyOnceWith(chunk);
        expect(onError).toHaveBeenCalledExactlyOnceWith({
          error: expect.objectContaining({ ...original, cause: original }),
        });
        expect(onFinish).toHaveBeenCalledTimes(1);
      }
    } finally {
      cleanup();
    }
  },
);
