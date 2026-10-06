import type { LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AISDKV5LanguageModel } from '../../llm/model/aisdk/v5/model';
import { loop } from '../../loop/loop';
import { getModelAttempt } from '../../loop/shared/model-attempt';
import { createMessageListWithUserMessage, defaultSettings } from '../../loop/test-utils/utils';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createSignal } from '../signals';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function answer(text = 'replacement answer'): LanguageModelV2StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'answer' },
    { type: 'text-delta', id: 'answer', delta: text },
    { type: 'text-end', id: 'answer' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } },
  ];
}

describe('queued signals preempt default-loop reasoning', () => {
  it.each(['ttfb', 'open-reasoning', 'signed-reasoning'] as const)(
    'cancels only the %s attempt and continues with a clean request and persisted history',
    async phase => {
      const started = deferred<void>();
      const aborted = deferred<void>();
      const prompts: unknown[] = [];
      const signals: AbortSignal[] = [];
      const onAbort = vi.fn();
      const onError = vi.fn();
      const onStepFinish = vi.fn();
      const stopWhen = vi.fn(() => false);
      const memory = new MockMemory();
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          if (abortSignal) signals.push(abortSignal);
          if (prompts.length > 1) return { stream: convertArrayToReadableStream(answer()), warnings: [] };
          if (!abortSignal) throw new Error('Expected model-call abort signal');
          abortSignal.addEventListener('abort', () => aborted.resolve(), { once: true });
          if (phase === 'ttfb') {
            started.resolve();
            await new Promise((_, reject) =>
              abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
            );
            throw new Error('Unreachable');
          }
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'discarded-block' });
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: 'discarded-block',
                  delta: 'STALE_REASONING_FINGERPRINT',
                });
                if (phase === 'signed-reasoning')
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: 'discarded-block',
                    providerMetadata: { anthropic: { signature: 'STALE_SIGNATURE' } },
                  });
                abortSignal.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                started.resolve();
              },
            }),
          };
        },
      });
      const runController = new AbortController();
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const agent = new Agent({
        id: crypto.randomUUID(),
        name: 'Preemption test',
        instructions: 'Test',
        model,
        memory,
      });
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 1,
        abortSignal: runController.signal,
        onAbort,
        onError,
        onStepFinish,
        stopWhen,
      });
      const chunks: string[] = [];
      const consumption = (async () => {
        for await (const chunk of stream.fullStream) chunks.push(chunk.type);
      })();
      await started.promise;
      if (phase !== 'ttfb') await vi.waitFor(() => expect(chunks).toContain('reasoning-delta'));
      const delivered = await Promise.all([
        agent.sendSignal({ type: 'user-message', contents: 'SYNTHETIC_SIGNAL_MARKER_A' }, scope),
        agent.sendSignal({ type: 'user-message', contents: 'SYNTHETIC_SIGNAL_MARKER_B' }, scope),
      ]);
      for (const signal of delivered)
        await expect(signal.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      await aborted.promise;
      await consumption;
      await stream._waitUntilFinished();
      expect(await stream.text).toBe('replacement answer');
      expect(prompts).toHaveLength(2);
      expect(JSON.stringify(prompts[1]).match(/SYNTHETIC_SIGNAL_MARKER_A/g)).toHaveLength(1);
      expect(JSON.stringify(prompts[1]).match(/SYNTHETIC_SIGNAL_MARKER_B/g)).toHaveLength(1);
      expect(JSON.stringify(prompts[1])).not.toContain('STALE_REASONING_FINGERPRINT');
      expect(JSON.stringify(prompts[1])).not.toContain('STALE_SIGNATURE');
      expect(runController.signal.aborted).toBe(false);
      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);
      expect(chunks).not.toContain('abort');
      expect(chunks).not.toContain('error');
      expect(chunks.filter(type => type === 'step-finish')).toHaveLength(1);
      expect(onAbort).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onStepFinish).toHaveBeenCalledTimes(1);
      expect(onStepFinish.mock.calls[0]?.[0]).toMatchObject({
        reasoning: [],
        reasoningText: '',
        text: 'replacement answer',
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
      });
      expect(stopWhen).not.toHaveBeenCalled();
      expect(await stream.steps).toHaveLength(1);
      expect(await stream.totalUsage).toMatchObject({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });
      const recalled = await memory.recall(scope);
      expect(JSON.stringify(recalled.messages)).toContain('replacement answer');
      expect(JSON.stringify(recalled.messages)).toContain('SYNTHETIC_SIGNAL_MARKER');
      expect(JSON.stringify(recalled.messages)).not.toContain('STALE_REASONING_FINGERPRINT');
      expect(JSON.stringify(recalled.messages)).not.toContain('STALE_SIGNATURE');
      expect(recalled.messages.filter(message => message.role === 'assistant')).toHaveLength(1);
    },
  );

  it('preempts generate during TTFB without entering error processors or losing the signal', async () => {
    const started = deferred<void>();
    const prompts: unknown[] = [];
    const processAPIError = vi.fn();
    const onAbort = vi.fn();
    const memory = new MockMemory();
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        if (prompts.length === 1) {
          started.resolve();
          await new Promise((_, reject) =>
            abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
          );
          throw new Error('Unreachable');
        }
        return {
          content: [{ type: 'text', text: 'generated replacement' }],
          finishReason: 'stop',
          usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
          warnings: [],
        };
      },
    });
    const settings = defaultSettings();
    const pending: ReturnType<typeof createSignal>[] = [];
    let notify!: () => void;
    const result = loop({
      ...settings,
      methodType: 'generate',
      messageList: createMessageListWithUserMessage(),
      models: [{ id: 'generate', model: new AISDKV5LanguageModel(model), maxRetries: 0 }],
      maxSteps: 3,
      options: { onAbort },
      errorProcessors: [{ id: 'track-errors', processAPIError }],
      _internal: {
        ...settings._internal,
        memory,
        drainPendingSignals: () => pending.splice(0),
        subscribePendingSignals: (_runId, listener) => {
          notify = listener;
          return () => {};
        },
      },
    });
    const consumption = result.consumeStream();
    await started.promise;
    pending.push(createSignal({ type: 'user-message', contents: 'GENERATE_SIGNAL' }));
    notify();
    await consumption;
    await result._waitUntilFinished();
    expect(await result.text).toBe('generated replacement');
    const steps = await result.steps;
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      text: 'generated replacement',
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });
    expect(await result.totalUsage).toMatchObject(steps[0].usage);
    expect(JSON.stringify(prompts[1])).toContain('GENERATE_SIGNAL');
    expect(processAPIError).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
  });

  it.each([
    { cancellation: 'caller', prior: false },
    { cancellation: 'caller', prior: true },
    { cancellation: 'total-timeout', prior: false },
    { cancellation: 'total-timeout', prior: true },
  ] as const)(
    'honors $cancellation after preemption without charging discarded output (prior accepted step: $prior)',
    async ({ cancellation, prior }) => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const onAbort = vi.fn();
      const onError = vi.fn();
      const processAPIError = vi.fn();
      const memory = new MockMemory();
      const runController = new AbortController();
      let modelCalls = 0;
      const acceptedUsage = {
        inputTokens: 3,
        outputTokens: 4,
        totalTokens: 7,
        cachedInputTokens: 1,
        reasoningTokens: 2,
      };
      const onStepFinish = vi.fn();
      const doStream = vi.fn(async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
        modelCalls++;
        if (prior && modelCalls === 1)
          return {
            warnings: [],
            stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'tool-call', toolCallId: 'prior-call', toolName: 'prior', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage: acceptedUsage },
            ]),
          };
        return {
          warnings: [],
          stream: new ReadableStream<LanguageModelV2StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'reasoning-start', id: 'discarded' });
              controller.enqueue({ type: 'reasoning-delta', id: 'discarded', delta: 'STALE_CANCELLED_REASONING' });
              abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
            },
          }),
        };
      });
      const settled = deferred<void>();
      const settings = defaultSettings();
      const messageList = createMessageListWithUserMessage();
      const pending: ReturnType<typeof createSignal>[] = [];
      let notify!: () => void;
      try {
        const stream = loop({
          ...settings,
          methodType: 'stream',
          messageList,
          models: [
            { id: 'cancel', model: new AISDKV5LanguageModel(new MockLanguageModelV2({ doStream })), maxRetries: 0 },
          ],
          maxSteps: 3,
          tools: {
            prior: createTool({
              id: 'prior',
              description: 'Prior accepted work',
              inputSchema: z.object({}),
              execute: async () => 'PRIOR_TOOL_RESULT',
            }),
          },
          options: { abortSignal: runController.signal, onAbort, onError, onStepFinish },
          errorProcessors: [{ id: 'track-errors', processAPIError }],
          outputProcessors: [
            {
              id: 'pause-reasoning',
              async processOutputStream({ part }) {
                if (part.type === 'reasoning-delta') {
                  const attempt = getModelAttempt(part);
                  if (!attempt) throw new Error('Missing model attempt');
                  const dispose = attempt.dispose.bind(attempt);
                  vi.spyOn(attempt, 'dispose').mockImplementation(() => {
                    dispose();
                    settled.resolve();
                  });
                  entered.resolve();
                  await release.promise;
                }
                return part;
              },
            },
          ],
          _internal: {
            ...settings._internal,
            memory,
            drainPendingSignals: () => pending.splice(0),
            subscribePendingSignals: (_runId, listener) => {
              notify = listener;
              return () => {};
            },
          },
          ...(cancellation === 'total-timeout' ? { modelSettings: { timeout: { totalMs: 100 } } } : {}),
        });
        const chunks: string[] = [];
        const consumption = (async () => {
          for await (const chunk of stream.fullStream) chunks.push(chunk.type);
        })();
        await entered.promise;
        pending.push(createSignal({ type: 'user-message', contents: 'CANCELLED_SIGNAL' }));
        notify();
        if (cancellation === 'caller') runController.abort();
        else await new Promise(resolve => setTimeout(resolve, 150));
        release.resolve();
        await settled.promise;
        await consumption;
        await stream._waitUntilFinished();
        expect(doStream).toHaveBeenCalledTimes(prior ? 2 : 1);
        expect(onStepFinish).toHaveBeenCalledTimes(prior ? 1 : 0);
        expect(chunks.filter(type => type === 'step-finish')).toHaveLength(prior ? 1 : 0);
        if (cancellation === 'total-timeout') {
          await expect(stream.steps).rejects.toThrow('Agent execution timed out');
          await expect(stream.totalUsage).rejects.toThrow('Agent execution timed out');
        } else {
          expect(await stream.steps).toHaveLength(prior ? 1 : 0);
          expect(await stream.totalUsage).toMatchObject(
            prior ? acceptedUsage : { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
          );
        }
        if (prior) {
          expect(onStepFinish).toHaveBeenCalledWith(
            expect.objectContaining({ usage: expect.objectContaining(acceptedUsage) }),
          );
          expect(JSON.stringify(messageList.get.all.db())).toContain('PRIOR_TOOL_RESULT');
        }
        expect(processAPIError).not.toHaveBeenCalled();
        if (cancellation === 'caller') {
          expect(chunks.filter(type => type === 'abort')).toHaveLength(1);
          expect(chunks).not.toContain('error');
          expect(onAbort).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        } else {
          expect(chunks.filter(type => type === 'error')).toHaveLength(1);
          expect(chunks).not.toContain('abort');
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onAbort).not.toHaveBeenCalled();
        }
        expect(JSON.stringify(messageList.get.all.db())).not.toContain('STALE_CANCELLED_REASONING');
      } finally {
        release.resolve();
      }
    },
  );

  it('drops a direct writer tripwire when a signal arrives during its violation callback', async () => {
    const entered = deferred<void>();
    const release = deferred<void>();
    const pending: ReturnType<typeof createSignal>[] = [];
    const messageList = createMessageListWithUserMessage();
    const settings = defaultSettings();
    const onStepFinish = vi.fn();
    const onAbort = vi.fn();
    const onError = vi.fn();
    const prompts: unknown[] = [];
    let notify!: () => void;
    let blockedPart: ChunkType | undefined;
    let first = true;
    const onViolation = vi.fn(async () => {
      entered.resolve();
      await release.promise;
    });
    const doStream = vi.fn(async ({ prompt }: LanguageModelV2CallOptions) => {
      prompts.push(prompt);
      return { warnings: [], stream: convertArrayToReadableStream(answer()) };
    });
    const stream = loop({
      ...settings,
      methodType: 'stream',
      messageList,
      models: [{ id: 'writer-race', model: new AISDKV5LanguageModel(new MockLanguageModelV2({ doStream })) }],
      maxSteps: 2,
      options: { onStepFinish, onAbort, onError },
      inputProcessors: [
        {
          id: 'write-before-request',
          async processLLMRequest({ prompt, writer }) {
            if (first) {
              first = false;
              await writer?.custom({
                type: 'reasoning-start',
                runId: 'writer-race',
                from: ChunkFrom.AGENT,
                payload: { id: 'blocked-writer-reasoning' },
              });
            }
            return { prompt };
          },
        },
      ],
      outputProcessors: [
        {
          id: 'direct-blocker',
          processOutputStream({ part, abort }) {
            if (part.type === 'reasoning-start' && part.payload.id === 'blocked-writer-reasoning') {
              blockedPart = part;
              abort('Block speculative writer reasoning');
            }
            return part;
          },
          onViolation,
        },
      ],
      _internal: {
        ...settings._internal,
        drainPendingSignals: () => pending.splice(0),
        subscribePendingSignals: (_runId, listener) => {
          notify = listener;
          return () => {};
        },
      },
    });
    const chunks: string[] = [];
    const consumption = (async () => {
      for await (const chunk of stream.fullStream) chunks.push(chunk.type);
    })();
    try {
      await entered.promise;
      expect(doStream).not.toHaveBeenCalled();
      pending.push(createSignal({ type: 'user-message', contents: 'VIOLATION_RACE_SIGNAL' }));
      notify();
      expect(getModelAttempt(blockedPart)?.discarded).toBe(true);
      release.resolve();
      await consumption;
      await stream._waitUntilFinished();
      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(chunks).not.toContain('tripwire');
      expect(chunks).not.toContain('abort');
      expect(chunks).not.toContain('error');
      expect(chunks.filter(type => type === 'finish')).toHaveLength(1);
      expect(chunks.filter(type => type === 'step-finish')).toHaveLength(1);
      expect(onStepFinish).toHaveBeenCalledTimes(1);
      expect(onStepFinish.mock.calls[0]?.[0]).toMatchObject({ text: 'replacement answer', reasoning: [] });
      expect(await stream.steps).toHaveLength(1);
      expect(await stream.text).toBe('replacement answer');
      expect(doStream).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(prompts[0])).toContain('VIOLATION_RACE_SIGNAL');
      expect(JSON.stringify(messageList.get.all.db())).not.toContain('blocked-writer-reasoning');
      expect(onAbort).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      release.resolve();
    }
  });

  it('keeps processor signals and emits their echoes exactly once after external preemption', async () => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let first = true;
    const input: Processor = {
      id: 'late-signal',
      async processInputStep({ messages, sendSignal }) {
        if (first) {
          first = false;
          entered.resolve();
          await release.promise;
          await sendSignal({ type: 'reactive', contents: 'PROCESSOR_SIGNAL_AFTER_DISCARD' });
        }
        return { messages };
      },
    };
    const prompts: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        return { warnings: [], stream: convertArrayToReadableStream(answer()) };
      },
    });
    const memory = new MockMemory();
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Input echo',
      instructions: 'Test',
      model,
      memory,
      inputProcessors: [input],
      outputProcessors: [{ id: 'stateless', processDataParts: true, processOutputStream: ({ part }) => part }],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const chunks: ChunkType[] = [];
    const consumption = (async () => {
      for await (const chunk of stream.fullStream) chunks.push(chunk);
    })();
    try {
      await entered.promise;
      const signal = await agent.sendSignal({ type: 'user-message', contents: 'EXTERNAL_SIGNAL' }, scope);
      await signal.accepted;
      release.resolve();
      await consumption;
      await stream._waitUntilFinished();
      expect(prompts).toHaveLength(1);
      expect(JSON.stringify(prompts[0])).toContain('PROCESSOR_SIGNAL_AFTER_DISCARD');
      expect(
        chunks.filter(
          chunk => chunk.type === 'data-signal' && JSON.stringify(chunk).includes('PROCESSOR_SIGNAL_AFTER_DISCARD'),
        ),
      ).toHaveLength(1);
      expect(JSON.stringify((await memory.recall({ ...scope, hideSignals: false })).messages)).toContain(
        'PROCESSOR_SIGNAL_AFTER_DISCARD',
      );
    } finally {
      release.resolve();
    }
  });

  it.each(['transformed', 'suppressed'] as const)('closes only emitted %s request-writer reasoning', async outcome => {
    const entered = deferred<void>();
    const release = deferred<void>();
    let first = true;
    const input: Processor = {
      id: 'reasoning-writer',
      async processLLMRequest({ prompt, writer }) {
        if (first) {
          first = false;
          await writer?.custom(
            outcome === 'transformed'
              ? { type: 'data-reasoning-placeholder', transient: true }
              : {
                  type: 'reasoning-start',
                  runId: 'synthetic-run',
                  from: ChunkFrom.AGENT,
                  payload: { id: 'writer-reasoning' },
                },
          );
          entered.resolve();
          await release.promise;
        }
        return { prompt };
      },
    };
    const output: Processor = {
      id: 'reasoning-transform',
      processDataParts: true,
      processOutputStream({ part }) {
        if (part.type === 'data-reasoning-placeholder')
          return {
            type: 'reasoning-start',
            runId: 'synthetic-run',
            from: part.from,
            payload: { id: 'writer-reasoning' },
          };
        if (part.type === 'reasoning-start') return null;
        return part;
      },
    };
    const memory = new MockMemory();
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Writer spans',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async () => ({ warnings: [], stream: convertArrayToReadableStream(answer()) }),
      }),
      inputProcessors: [input],
      outputProcessors: [output],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const types: string[] = [];
    const consumption = (async () => {
      for await (const chunk of stream.fullStream) types.push(chunk.type);
    })();
    try {
      await entered.promise;
      const signal = await agent.sendSignal({ type: 'user-message', contents: 'AFTER_REASONING_WRITER' }, scope);
      await signal.accepted;
      release.resolve();
      await consumption;
      await stream._waitUntilFinished();
      expect(types.filter(type => type === 'reasoning-start')).toHaveLength(outcome === 'transformed' ? 1 : 0);
      expect(types.filter(type => type === 'reasoning-end')).toHaveLength(outcome === 'transformed' ? 1 : 0);
    } finally {
      release.resolve();
    }
  });

  it.each(['returned-data', 'returned-text', 'nested-writer'] as const)(
    'discards in-flight request-writer %s before emission or persistence',
    async output => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const prompts: unknown[] = [];
      const doStream = vi.fn(async ({ prompt }: LanguageModelV2CallOptions) => {
        prompts.push(prompt);
        return { warnings: [], stream: convertArrayToReadableStream(answer()) };
      });
      let first = true;
      const requestProcessor: Processor = {
        id: 'request-writer',
        async processLLMRequest({ prompt, writer }) {
          if (first) {
            first = false;
            await writer?.custom({ type: 'data-request-status', data: 'transient', transient: true });
          }
          return { prompt };
        },
      };
      const dataProcessor: Processor = {
        id: 'delayed-writer-output',
        processDataParts: true,
        async processOutputStream({ part, writer }) {
          if (part.type !== 'data-request-status') return part;
          entered.resolve();
          await release.promise;
          if (output === 'nested-writer') {
            await writer?.custom({ type: 'data-discarded', data: 'DISCARDED_WRITER_MARKER' });
            return null;
          }
          if (output === 'returned-data') return { type: 'data-discarded', data: 'DISCARDED_WRITER_MARKER' };
          return {
            type: 'text-delta',
            runId: part.runId,
            from: part.from,
            payload: { id: 'discarded', text: 'DISCARDED_WRITER_MARKER' },
          };
        },
      };
      const memory = new MockMemory();
      const agent = new Agent({
        id: crypto.randomUUID(),
        name: 'Writer preemption',
        instructions: 'Test',
        memory,
        model: new MockLanguageModelV2({ doStream }),
        inputProcessors: [requestProcessor],
        outputProcessors: [dataProcessor],
      });
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const stream = await agent.stream('initial', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 3,
      });
      const chunks: ChunkType[] = [];
      const consumption = (async () => {
        for await (const chunk of stream.fullStream) chunks.push(chunk);
      })();
      try {
        await entered.promise;
        const signal = await agent.sendSignal({ type: 'user-message', contents: 'WRITER_SIGNAL' }, scope);
        await signal.accepted;
        await Promise.resolve();
        expect(doStream).not.toHaveBeenCalled();
        release.resolve();
        await consumption;
        await stream._waitUntilFinished();
        expect(doStream).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(prompts[0])).toContain('WRITER_SIGNAL');
        expect(JSON.stringify(chunks)).not.toContain('DISCARDED_WRITER_MARKER');
        expect(JSON.stringify((await memory.recall(scope)).messages)).not.toContain('DISCARDED_WRITER_MARKER');
        expect(await stream.steps).toHaveLength(1);
        expect((await stream.steps)[0]).toMatchObject({ text: 'replacement answer', reasoning: [] });
      } finally {
        release.resolve();
      }
    },
  );

  it('protects transformed request-writer data before committing it', async () => {
    const committed = deferred<void>();
    const release = deferred<void>();
    let first = true;
    const requestProcessor: Processor = {
      id: 'request-writer',
      async processLLMRequest({ prompt, writer }) {
        if (first) {
          first = false;
          await writer?.custom({ type: 'data-request-status', transient: true });
          committed.resolve();
          await release.promise;
        }
        return { prompt };
      },
    };
    const dataProcessor: Processor = {
      id: 'committed-writer-output',
      processDataParts: true,
      processOutputStream({ part }) {
        return part.type === 'data-request-status' ? { type: 'data-accepted', data: 'ACCEPTED_WRITER_MARKER' } : part;
      },
    };
    const doStream = vi.fn(async () => ({ warnings: [], stream: convertArrayToReadableStream(answer()) }));
    const memory = new MockMemory();
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Protected writer',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({ doStream }),
      inputProcessors: [requestProcessor],
      outputProcessors: [dataProcessor],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const consumption = stream.consumeStream();
    try {
      await committed.promise;
      const signal = await agent.sendSignal({ type: 'user-message', contents: 'AFTER_WRITER_SIGNAL' }, scope);
      await signal.accepted;
      release.resolve();
      await consumption;
      await stream._waitUntilFinished();
      expect(doStream).toHaveBeenCalledTimes(2);
      expect((await stream.steps)[0].text).toBe('replacement answer');
      expect(JSON.stringify((await memory.recall(scope)).messages)).toContain('ACCEPTED_WRITER_MARKER');
    } finally {
      release.resolve();
    }
  });

  it('retains an already selected fallback without borrowing usage from its failed predecessor', async () => {
    const started = deferred<void>();
    const primary = vi.fn(async () => {
      throw new Error('primary model request failed');
    });
    const prompts: unknown[] = [];
    const fallback = vi.fn(async ({ prompt, abortSignal }: LanguageModelV2CallOptions) => {
      prompts.push(prompt);
      if (prompts.length === 1) {
        started.resolve();
        await new Promise((_, reject) =>
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
        );
        throw new Error('Unreachable');
      }
      return { warnings: [], stream: convertArrayToReadableStream(answer()) };
    });
    const memory = new MockMemory();
    const onStepFinish = vi.fn();
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Fallback preemption',
      instructions: 'Test',
      memory,
      errorProcessorDefaults: false,
      model: [
        { model: new MockLanguageModelV2({ modelId: 'primary', doStream: primary }), maxRetries: 0 },
        { model: new MockLanguageModelV2({ modelId: 'fallback', doStream: fallback }), maxRetries: 0 },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
      onStepFinish,
    });
    const consumption = stream.consumeStream();
    await vi.waitFor(() => expect(fallback).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await started.promise;
    const signal = await agent.sendSignal({ type: 'user-message', contents: 'FALLBACK_SIGNAL' }, scope);
    await expect(signal.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    await consumption;
    await stream._waitUntilFinished();
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(await stream.text).toBe('replacement answer');
    expect(onStepFinish).toHaveBeenCalledTimes(1);
    expect(onStepFinish.mock.calls[0]?.[0]).toMatchObject({
      text: 'replacement answer',
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });
    expect(JSON.stringify(prompts[1])).toContain('FALLBACK_SIGNAL');
    expect(JSON.stringify(prompts[1])).not.toContain('FAILED_MODEL_REASONING');
  });

  it('preserves signed/tool steps and their logical ordinals across discarded attempts', async () => {
    const reasoning = deferred<void>();
    const prompts: unknown[] = [];
    const snapshots: Array<{ stepNumber: number; content: string[] }> = [];
    const stateIdentities = new Set<object>();
    const stopStepCounts: number[] = [];
    const stopWhen = vi.fn(({ steps }: { steps: unknown[] }) => {
      stopStepCounts.push(steps.length);
      return false;
    });
    const onStepFinish = vi.fn();
    const onIterationComplete = vi.fn();
    const execute = vi.fn(async () => ({ result: 'tool result' }));
    const memory = new MockMemory();
    const capture: Processor = {
      id: 'capture-input-steps',
      processInputStep: async ({ stepNumber, steps, state }) => {
        stateIdentities.add(state);
        snapshots.push({ stepNumber, content: steps.map(step => JSON.stringify(step.content)) });
      },
    };
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        const index = prompts.length;
        if (index === 2)
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'reasoning-start', id: 'discarded' });
                controller.enqueue({ type: 'reasoning-delta', id: 'discarded', delta: 'STALE_REASONING_FINGERPRINT' });
                abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
              },
            }),
          };
        if (index === 4) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
        const signed: LanguageModelV2StreamPart[] =
          index === 1
            ? [
                { type: 'reasoning-start', id: 'accepted-thinking' },
                { type: 'reasoning-delta', id: 'accepted-thinking', delta: 'KEPT_THINKING' },
                {
                  type: 'reasoning-end',
                  id: 'accepted-thinking',
                  providerMetadata: { anthropic: { signature: 'KEPT_SIGNATURE' } },
                },
              ]
            : [];
        return {
          warnings: [],
          stream: convertArrayToReadableStream([
            ...signed,
            { type: 'tool-call', toolCallId: `call-${index}`, toolName: 'probe', input: '{}' },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: index, outputTokens: index, totalTokens: index * 2 },
            },
          ]),
        };
      },
    });
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Transcript accounting',
      instructions: 'Test',
      model,
      memory,
      inputProcessors: [capture],
      tools: {
        probe: createTool({
          id: 'probe',
          description: 'Probe',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
          execute,
        }),
      },
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 4,
      onStepFinish,
      onIterationComplete,
      stopWhen,
      onChunk: chunk => {
        if (chunk.type === 'reasoning-delta' && chunk.payload.text === 'STALE_REASONING_FINGERPRINT')
          reasoning.resolve();
      },
    });
    const consumption = stream.consumeStream();
    await reasoning.promise;
    const signal = await agent.sendSignal({ type: 'user-message', contents: 'NEW_QUESTION' }, scope);
    await signal.accepted;
    await consumption;
    await stream._waitUntilFinished();
    expect(prompts).toHaveLength(4);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(onStepFinish).toHaveBeenCalledTimes(3);
    expect(stopWhen).toHaveBeenCalledTimes(2);
    expect(stopStepCounts).toEqual([1, 2]);
    expect(onIterationComplete.mock.calls.map(([context]) => context.iteration)).toEqual([1, 2, 3]);
    const steps = await stream.steps;
    expect(steps).toHaveLength(3);
    expect(JSON.stringify(steps[0]?.content)).toContain('call-1');
    expect(JSON.stringify(steps[1]?.content)).toContain('call-3');
    expect(JSON.stringify(steps[1]?.content)).not.toContain('call-1');
    expect(steps[2]?.text).toBe('replacement answer');
    expect(snapshots.map(snapshot => snapshot.stepNumber)).toEqual([0, 1, 1, 2]);
    expect(snapshots[3]?.content).toHaveLength(2);
    expect(snapshots[3]?.content[0]).toContain('tool result');
    expect(snapshots[3]?.content[1]).toContain('tool result');
    expect(stateIdentities.size).toBe(1);
    expect(JSON.stringify(prompts[2])).toContain('KEPT_SIGNATURE');
    expect(JSON.stringify(prompts[2])).not.toContain('STALE_REASONING_FINGERPRINT');
    const recalled = await memory.recall(scope);
    expect(JSON.stringify(recalled.messages)).toContain('KEPT_SIGNATURE');
    expect(JSON.stringify(recalled.messages)).not.toContain('STALE_REASONING_FINGERPRINT');
    expect(recalled.messages.filter(message => message.role === 'assistant')).toHaveLength(2);
  });

  it('retries the same logical step without a signal cap, step-budget charge or processor retry', async () => {
    const ready = Array.from({ length: 5 }, () => deferred<void>());
    const prompts: unknown[] = [];
    const prepareSteps: number[] = [];
    const inputSteps: number[] = [];
    const requestSteps: number[] = [];
    const retryCounts: number[] = [];
    const stepLengths: number[] = [];
    const processAPIError = vi.fn();
    const onStepFinish = vi.fn();
    const onIterationComplete = vi.fn();
    const onAbort = vi.fn();
    const memory = new MockMemory();
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        const number = prompts.length;
        if (number > ready.length) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
        return {
          warnings: [],
          stream: new ReadableStream<LanguageModelV2StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'reasoning-start', id: `attempt-${number}` });
              controller.enqueue({
                type: 'reasoning-delta',
                id: `attempt-${number}`,
                delta: `STALE_ATTEMPT_${number}`,
              });
              abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
            },
          }),
        };
      },
    });
    const agent = new Agent({
      id: crypto.randomUUID(),
      name: 'Same-step preemption',
      instructions: 'Test',
      model,
      memory,
      inputProcessors: [
        {
          id: 'step-accounting',
          processInputStep({ messageList, stepNumber }) {
            inputSteps.push(stepNumber);
            return messageList;
          },
          processLLMRequest({ prompt, stepNumber, retryCount, steps }) {
            requestSteps.push(stepNumber);
            retryCounts.push(retryCount);
            stepLengths.push(steps.length);
            return { prompt };
          },
          processAPIError,
        },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 1,
      prepareStep: ({ stepNumber }) => {
        prepareSteps.push(stepNumber);
      },
      onStepFinish,
      onIterationComplete,
      onAbort,
      onChunk: chunk => {
        if (chunk.type === 'reasoning-delta') ready[Number(chunk.payload.text.split('_').at(-1)) - 1]?.resolve();
      },
    });
    const consumption = stream.consumeStream();
    for (let index = 0; index < ready.length; index++) {
      await ready[index]?.promise;
      const signal = await agent.sendSignal({ type: 'user-message', contents: `QUEUED_SIGNAL_${index + 1}` }, scope);
      await expect(signal.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    }
    await consumption;
    await stream._waitUntilFinished();
    expect(prompts).toHaveLength(6);
    expect(prepareSteps).toEqual([0, 0, 0, 0, 0, 0]);
    expect(inputSteps).toEqual(prepareSteps);
    expect(requestSteps).toEqual(prepareSteps);
    expect(retryCounts).toEqual(prepareSteps);
    expect(stepLengths).toEqual(prepareSteps);
    expect(processAPIError).not.toHaveBeenCalled();
    expect(await stream.text).toBe('replacement answer');
    expect(await stream.steps).toHaveLength(1);
    expect(await stream.totalUsage).toMatchObject({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });
    expect(onStepFinish).toHaveBeenCalledTimes(1);
    expect(onAbort).not.toHaveBeenCalled();
    expect(onStepFinish.mock.calls[0]?.[0]).toMatchObject({ text: 'replacement answer', reasoning: [] });
    expect(onIterationComplete).toHaveBeenCalledTimes(1);
    expect(onIterationComplete.mock.calls[0]?.[0]).toMatchObject({
      iteration: 1,
      isFinal: true,
      text: 'replacement answer',
    });
    for (let index = 0; index < ready.length; index++)
      expect(JSON.stringify(prompts[index + 1])).toContain(`QUEUED_SIGNAL_${index + 1}`);
    expect(JSON.stringify(prompts)).not.toContain('STALE_ATTEMPT_');
    const recalled = await memory.recall(scope);
    expect(JSON.stringify(recalled.messages)).toContain('QUEUED_SIGNAL_5');
    expect(recalled.messages.filter(message => message.role === 'assistant')).toHaveLength(1);
    expect(JSON.stringify(recalled.messages)).not.toContain('STALE_ATTEMPT_');
  });
});
