import { ReadableStream } from 'node:stream/web';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../agent/message-list';
import { bindModelAttempt, ModelAttempt } from '../../loop/shared/model-attempt';
import type { Processor } from '../../processors';
import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import { ProcessorState } from '../../processors/runner';
import type { ChunkType, LLMStepResult } from '../types';
import { ChunkFrom } from '../types';
import { MastraModelOutput } from './output';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const reasoning: ChunkType = {
  type: 'reasoning-delta',
  runId: 'run',
  from: ChunkFrom.AGENT,
  payload: { id: 'thinking', text: 'synthetic discarded reasoning' },
};

function createOutput(processors: Processor[], chunks: ChunkType[], states = new Map<string, ProcessorState>()) {
  let notify!: () => void;
  const attempt = new ModelAttempt(undefined, listener => {
    notify = listener;
    return () => {};
  });
  attempt.arm();
  const stream = new ReadableStream<ChunkType>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  bindModelAttempt(stream, attempt);
  const messageList = new MessageList({ threadId: 'thread' });
  const output = new MastraModelOutput({
    model: { modelId: 'test-model', provider: 'test', version: 'v2' },
    stream,
    messageList,
    messageId: 'response',
    options: { runId: 'run', isLLMExecutionStep: true, outputProcessors: processors, processorStates: states },
  });
  const emitted: ChunkType[] = [];
  const drained = (async () => {
    for await (const chunk of output._getBaseStream()) emitted.push(chunk);
  })();
  return { attempt, notify, messageList, states, emitted, drained };
}

describe('model attempt output ownership', () => {
  it('waits for an in-flight processor before the discard completes', async () => {
    const entered = gate();
    const release = gate();
    const { attempt, notify, drained } = createOutput(
      [
        {
          id: 'slow',
          async processOutputStream({ part }) {
            entered.resolve();
            await release.promise;
            return part;
          },
        },
      ],
      [reasoning],
    );
    await entered.promise;
    notify();
    let cleaned = false;
    const cleanup = attempt.discardOutput().then(() => {
      cleaned = true;
    });
    await Promise.resolve();
    expect(cleaned).toBe(false);
    release.resolve();
    await Promise.all([drained, cleanup]);
    expect(cleaned).toBe(true);
    attempt.dispose();
  });

  it.each(['text-start', 'tool-call-input-streaming-start'] as const)(
    'protects raw %s even when an output processor blocks it',
    async type => {
      const entered = gate();
      const release = gate();
      const boundary: ChunkType =
        type === 'text-start'
          ? { type, runId: 'run', from: ChunkFrom.AGENT, payload: { id: 'text' } }
          : { type, runId: 'run', from: ChunkFrom.AGENT, payload: { toolCallId: 'call', toolName: 'tool' } };
      const { attempt, notify, emitted, drained } = createOutput(
        [
          {
            id: 'suppress',
            async processOutputStream() {
              entered.resolve();
              await release.promise;
              return null;
            },
          },
        ],
        [boundary],
      );
      await entered.promise;
      notify();
      expect(attempt.discarded).toBe(false);
      release.resolve();
      await drained;
      expect(emitted).toEqual([]);
      attempt.dispose();
    },
  );

  it('drops disposed-attempt reasoning delivered after a preceding completion callback settles', async () => {
    const entered = gate();
    const release = gate();
    let notify!: () => void;
    const discarded = new ModelAttempt(undefined, listener => {
      notify = listener;
      return () => {};
    });
    discarded.arm();
    let controller!: ReadableStreamDefaultController<ChunkType>;
    const stream = new ReadableStream<ChunkType>({
      start(source) {
        controller = source;
      },
    });
    const finishStep: ChunkType = {
      type: 'step-finish',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop', isContinued: false },
        output: { usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }, steps: [] },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    };
    const completed: LLMStepResult[] = [];
    const onStepFinish = vi.fn(async (step: LLMStepResult) => {
      completed.push(step);
      if (completed.length === 1) {
        entered.resolve();
        await release.promise;
      }
    });
    const output = new MastraModelOutput({
      stream,
      model: { modelId: 'test', provider: 'test', version: 'v2' },
      messageList: new MessageList(),
      messageId: 'message',
      options: { runId: 'run', onStepFinish },
    });
    const consumption = output.consumeStream();
    try {
      controller.enqueue(finishStep);
      await entered.promise;
      const staleStart: ChunkType = {
        type: 'reasoning-start',
        runId: 'run',
        from: ChunkFrom.AGENT,
        payload: { id: 'transformed-reused-id' },
      };
      const staleDelta: ChunkType = {
        ...reasoning,
        payload: { id: 'transformed-reused-id', text: 'LATE_DISCARDED_THINKING' },
      };
      for (const chunk of [staleStart, staleDelta]) {
        bindModelAttempt(chunk, discarded);
        controller.enqueue(chunk);
      }
      notify();
      await discarded.discardOutput();
      discarded.dispose();
      controller.enqueue({ ...staleStart });
      controller.enqueue({
        ...staleDelta,
        payload: { id: 'transformed-reused-id', text: 'accepted replacement thinking' },
      });
      controller.enqueue({
        type: 'reasoning-end',
        runId: 'run',
        from: ChunkFrom.AGENT,
        payload: { id: 'transformed-reused-id' },
      });
      controller.enqueue({ ...finishStep });
      controller.enqueue({ ...finishStep, type: 'finish' });
      controller.close();
      release.resolve();
      await consumption;
      expect(onStepFinish).toHaveBeenCalledTimes(2);
      expect(onStepFinish.mock.calls[1]?.[0]).toMatchObject({ reasoningText: 'accepted replacement thinking' });
      expect(JSON.stringify(await output.steps)).not.toContain('LATE_DISCARDED_THINKING');
      expect(await output.totalUsage).toMatchObject({ inputTokens: 6, outputTokens: 8, totalTokens: 14 });
    } finally {
      release.resolve();
      discarded.dispose();
    }
  });

  it.each([true, false])('drops only discarded built-in batch buffers (emitOnNonText=%s)', async emitOnNonText => {
    const states = new Map<string, ProcessorState>();
    const batchState = new ProcessorState();
    const stable = {};
    batchState.customState.stable = stable;
    states.set('batch-parts', batchState);
    const batch = new BatchPartsProcessor({ batchSize: 100, emitOnNonText, maxWaitTime: 60_000 });
    const { attempt, notify, drained } = createOutput(
      [batch],
      [reasoning, { type: 'reasoning-end', runId: 'run', from: ChunkFrom.AGENT, payload: { id: 'thinking' } }],
      states,
    );
    await drained;
    notify();
    await attempt.discardOutput();
    expect(batchState.customState.batch ?? []).toEqual([]);
    expect(batchState.customState.timeoutId).toBeUndefined();
    expect(batchState.customState.timeoutTriggered).toBe(false);
    expect(batchState.customState.stable).toBe(stable);
    expect(batch.flush(batchState.customState as Parameters<typeof batch.flush>[0])).toBeNull();
    attempt.dispose();
  });
});
