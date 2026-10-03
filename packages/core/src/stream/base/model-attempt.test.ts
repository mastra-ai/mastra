import { ReadableStream } from 'node:stream/web';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MessageList } from '../../agent/message-list';
import { bindModelAttempt, ModelAttempt } from '../../loop/shared/model-attempt';
import type { Processor, ProcessorStreamWriter } from '../../processors';
import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import { StructuredOutputProcessor } from '../../processors/processors/structured-output';
import { ProcessorRunner, ProcessorState } from '../../processors/runner';
import { REPROCESS_PART_KEY } from '../../processors/stream-reprocess';
import type { ChunkType } from '../types';
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
const text: ChunkType = {
  type: 'text-delta',
  runId: 'run',
  from: ChunkFrom.AGENT,
  payload: { id: 'text', text: 'stale text' },
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
  it.each([false, true])(
    'forwards attempt cancellation while respecting an explicit processor signal (%s)',
    async explicit => {
      const attempt = new ModelAttempt();
      const part = { ...reasoning };
      bindModelAttempt(part, attempt);
      const signal = new AbortController().signal;
      const processOutputStream = vi.fn(({ part }) => part);
      const runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: [{ id: 'observe-signal', processOutputStream }],
      });
      try {
        await runner.processPart(
          part,
          new Map(),
          undefined,
          undefined,
          undefined,
          0,
          undefined,
          explicit ? signal : undefined,
        );
        expect(processOutputStream).toHaveBeenCalledWith(
          expect.objectContaining({ abortSignal: explicit ? signal : attempt.controller.signal }),
        );
      } finally {
        attempt.dispose();
      }
    },
  );

  it('owns processor work per chunk when one transport stream spans successive attempts', async () => {
    const entered = gate();
    const release = gate();
    let notify!: () => void;
    const discarded = new ModelAttempt(undefined, listener => {
      notify = listener;
      return () => {};
    });
    discarded.arm();
    const successor = new ModelAttempt();
    successor.arm();
    let retainedWriter: ProcessorStreamWriter | undefined;
    let controller!: ReadableStreamDefaultController<ChunkType>;
    const stream = new ReadableStream<ChunkType>({
      start(value) {
        controller = value;
      },
    });
    const messageList = new MessageList({ threadId: 'thread' });
    const stale = { ...reasoning };
    bindModelAttempt(stale, discarded);
    const states = new Map<string, ProcessorState>();
    const output = new MastraModelOutput({
      model: { modelId: 'test-model', provider: 'test', version: 'v2' },
      stream,
      messageList,
      messageId: 'response',
      options: {
        runId: 'run',
        isLLMExecutionStep: true,
        processorStates: states,
        outputProcessors: [
          {
            id: 'transport',
            async processOutputStream({ part, writer }) {
              if (part.type === 'reasoning-delta') {
                retainedWriter = writer;
                entered.resolve();
                await release.promise;
                await writer?.custom({ type: 'data-stale', data: 'discarded' });
                return text;
              }
              return part;
            },
          },
        ],
      },
    });
    const emitted: ChunkType[] = [];
    const consumption = (async () => {
      for await (const part of output._getBaseStream()) emitted.push(part);
    })();
    controller.enqueue(stale);
    await entered.promise;
    notify();
    const cleanup = discarded.discardOutput();
    release.resolve();
    await cleanup;
    const replacement = { ...text, payload: { id: 'replacement', text: 'accepted replacement' } };
    bindModelAttempt(replacement, successor);
    controller.enqueue(replacement);
    controller.close();
    await consumption;
    await retainedWriter?.custom({ type: 'data-late', data: 'discarded' });
    expect(emitted).toEqual([replacement]);
    expect(messageList.get.response.db()).toEqual([]);
    expect(states.get('transport')?.streamParts).toEqual([replacement]);
    discarded.dispose();
    successor.dispose();
  });

  it('waits for an in-flight processor and drops its returned text, late writes and direct controller output', async () => {
    const entered = gate();
    const release = gate();
    const states = new Map<string, ProcessorState>();
    const structured = new ProcessorState();
    states.set('structured-output', structured);
    const prior = new ProcessorState();
    const stable = {};
    const priorPart: ChunkType = { ...reasoning, payload: { id: 'prior', text: 'accepted prior reasoning' } };
    prior.streamParts.push(priorPart);
    prior.customState.stable = stable;
    const priorDeferred = { ...priorPart };
    prior.customState[REPROCESS_PART_KEY] = priorDeferred;
    states.set('slow', prior);
    let retainedWriter: ProcessorStreamWriter | undefined;
    const downstream = vi.fn(({ part }) => part);
    const { attempt, notify, messageList, emitted, drained } = createOutput(
      [
        {
          id: 'slow',
          async processOutputStream({ writer, state }) {
            retainedWriter = writer;
            state.inputSideEffect = 'preserved';
            delete state[REPROCESS_PART_KEY];
            entered.resolve();
            await release.promise;
            await writer?.custom({ type: 'data-late', data: 'discarded' });
            const controller = structured.customState.controller as { enqueue: (chunk: ChunkType) => void };
            controller.enqueue(text);
            return text;
          },
        },
        { id: 'downstream', processOutputStream: downstream },
      ],
      [reasoning],
      states,
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
    expect(emitted).toEqual([]);
    expect(downstream).not.toHaveBeenCalled();
    expect(messageList.get.response.db()).toEqual([]);
    expect(prior.streamParts).toEqual([priorPart]);
    expect(prior.customState[REPROCESS_PART_KEY]).toBe(priorDeferred);
    expect(prior.customState.stable).toBe(stable);
    expect(prior.customState.inputSideEffect).toBe('preserved');
    await retainedWriter?.custom({ type: 'data-even-later', data: 'discarded' });
    expect(messageList.get.response.db()).toEqual([]);
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

  it('protects substantive processor output before a later processor can suppress it', async () => {
    const entered = gate();
    const release = gate();
    const { attempt, notify, drained } = createOutput(
      [
        { id: 'produce-text', processOutputStream: () => text },
        {
          id: 'suppress',
          async processOutputStream() {
            entered.resolve();
            await release.promise;
            return null;
          },
        },
      ],
      [reasoning],
    );
    await entered.promise;
    notify();
    expect(attempt.discarded).toBe(false);
    release.resolve();
    await drained;
    attempt.dispose();
  });

  it('protects and persists processor-written data before returning from the hook', async () => {
    const entered = gate();
    const release = gate();
    const { attempt, notify, messageList, emitted, drained } = createOutput(
      [
        {
          id: 'writer',
          async processOutputStream({ writer, part }) {
            await writer?.custom({ type: 'data-accepted', data: 'accepted' });
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
    expect(attempt.discarded).toBe(false);
    release.resolve();
    await drained;
    expect(emitted.some(chunk => chunk.type === 'data-accepted')).toBe(true);
    expect(messageList.get.response.db()[0]?.content.parts).toContainEqual({
      type: 'data-accepted',
      data: 'accepted',
      createdAt: expect.any(Number),
    });
    attempt.dispose();
  });

  it('cancels an in-flight structuring request and resets only its attempt state before structuring the replacement', async () => {
    const entered = gate();
    const prompts: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        if (prompts.length === 1)
          return {
            warnings: [],
            stream: new ReadableStream({
              start(controller) {
                abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                entered.resolve();
              },
            }),
          };
        return {
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'structured' },
            { type: 'text-delta', id: 'structured', delta: '{"answer":"clean"}' },
            { type: 'text-end', id: 'structured' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const processor = new StructuredOutputProcessor({ model, schema: z.object({ answer: z.string() }) });
    const states = new Map<string, ProcessorState>();
    const finish: ChunkType = {
      type: 'finish',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined } },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    };
    const discarded = createOutput([processor], [reasoning, finish], states);
    await entered.promise;
    discarded.notify();
    await Promise.all([discarded.drained, discarded.attempt.discardOutput()]);
    expect(discarded.emitted.some(chunk => chunk.type === 'object-result')).toBe(false);
    const priorState = states.get(processor.id);
    expect(priorState?.streamParts).toEqual([]);
    discarded.attempt.dispose();
    const replacement = createOutput(
      [processor],
      [{ ...text, payload: { id: 'replacement', text: 'replacement clean' } }, finish],
      states,
    );
    await replacement.drained;
    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[1])).toContain('replacement clean');
    expect(JSON.stringify(prompts[1])).not.toContain('synthetic discarded reasoning');
    expect(replacement.emitted).toContainEqual(
      expect.objectContaining({ type: 'object-result', object: { answer: 'clean' } }),
    );
    expect(states.get(processor.id)).toBe(priorState);
    replacement.attempt.dispose();
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
    expect(batchState.streamParts).toEqual([]);
    expect(batchState.customState.batch ?? []).toEqual([]);
    expect(batchState.customState.timeoutId).toBeUndefined();
    expect(batchState.customState.timeoutTriggered).toBe(false);
    expect(batchState.customState.stable).toBe(stable);
    expect(batch.flush(batchState.customState as Parameters<typeof batch.flush>[0])).toBeNull();
    attempt.dispose();
  });
});
