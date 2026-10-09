import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../../evals';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { StructuredOutputProcessor } from '../../../processors/processors/structured-output';
import { InMemoryStore } from '../../../storage';
import type { ChunkType } from '../../../stream/types';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

function answer(): LanguageModelV2StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'answer' },
    { type: 'text-delta', id: 'answer', delta: 'replacement answer' },
    { type: 'text-end', id: 'answer' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } },
  ];
}

class JSONStreamPubSub extends EventEmitterPubSub {
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    const [topic, event, options] = args;
    if (!topic.startsWith('agent.stream.')) return super.publish(topic, event, options);
    const serialized = JSON.stringify(event, (_key, value) => {
      if (typeof value === 'function' || value instanceof AbortController || value instanceof AbortSignal) {
        throw new Error('Ephemeral attempt state escaped into a stream event');
      }
      return value;
    });
    return super.publish(topic, JSON.parse(serialized), options);
  }
}

class DelayedReasoningPubSub extends JSONStreamPubSub {
  readonly pending: Parameters<EventEmitterPubSub['publish']>[] = [];
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    if (args[0].startsWith('agent.stream.') && args[1].data?.type?.startsWith('reasoning-')) {
      this.pending.push(args);
      return;
    }
    return super.publish(...args);
  }
  async deliverPending() {
    for (const args of this.pending.splice(0)) await super.publish(...args);
  }
}

type Engine = 'durable' | 'evented' | 'evented-split' | 'evented-json';

function createOwner(
  engine: Engine,
  config: ConstructorParameters<typeof Agent>[0],
  pubsub?: EventEmitterPubSub,
  agentPubsub?: EventEmitterPubSub,
) {
  const baseAgent = new Agent(config);
  const customPubsub =
    agentPubsub ??
    (engine === 'evented-json'
      ? new JSONStreamPubSub()
      : engine === 'evented-split'
        ? new EventEmitterPubSub()
        : undefined);
  const agent =
    engine === 'durable'
      ? createDurableAgent({ agent: baseAgent, pubsub: customPubsub })
      : createEventedAgent({ agent: baseAgent, pubsub: customPubsub });
  const mastra = new Mastra({ agents: { owner: agent }, storage: new InMemoryStore(), logger: false, pubsub });
  return { agent, mastra, customPubsub };
}

async function collect(stream: AsyncIterable<ChunkType>, chunks: ChunkType[] = []) {
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

describe.each(['durable', 'evented', 'evented-split', 'evented-json'] as const)('%s reasoning preemption', engine => {
  it.each(['ttfb', 'reasoning', 'signed', 'encrypted'] as const)(
    'cancels %s without terminating the run or retaining discarded history',
    async phase => {
      let started = false;
      let providerAborted = false;
      const prompts: unknown[] = [];
      const signals: AbortSignal[] = [];
      const memory = new MockMemory();
      const onFinish = vi.fn();
      const onAbort = vi.fn();
      const onError = vi.fn();
      const onStepFinish = vi.fn();
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          if (!abortSignal) throw new Error('Expected model abort signal');
          signals.push(abortSignal);
          if (prompts.length > 1) return { stream: convertArrayToReadableStream(answer()), warnings: [] };
          abortSignal.addEventListener(
            'abort',
            () => {
              providerAborted = true;
            },
            { once: true },
          );
          if (phase === 'ttfb') {
            started = true;
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
                controller.enqueue({ type: 'reasoning-start', id: 'discarded' });
                controller.enqueue({ type: 'reasoning-delta', id: 'discarded', delta: 'STALE_REASONING_FINGERPRINT' });
                if (phase === 'signed' || phase === 'encrypted')
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: 'discarded',
                    providerMetadata:
                      phase === 'signed'
                        ? { anthropic: { signature: 'STALE_SIGNATURE' } }
                        : { openai: { itemId: 'STALE_ITEM_ID', reasoningEncryptedContent: 'STALE_ENCRYPTED' } },
                  });
                abortSignal.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                started = true;
              },
            }),
          };
        },
      });
      const { agent, mastra, customPubsub } = createOwner(engine, {
        id: crypto.randomUUID(),
        name: 'Preemption owner',
        instructions: 'Test',
        model,
        memory,
      });
      const events: string[] = [];
      await mastra.pubsub.subscribe('workflows', event => events.push(event.type));
      const runController = new AbortController();
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 1,
        abortSignal: runController.signal,
        onFinish,
        onAbort,
        onError,
        onStepFinish,
      });
      const chunks: ChunkType[] = [];
      const consumption = (async () => {
        for await (const chunk of stream.fullStream) chunks.push(chunk);
      })();
      try {
        await vi.waitFor(() => expect(started).toBe(true));
        if (phase !== 'ttfb')
          await vi.waitFor(() => expect(chunks.some(chunk => chunk.type === 'reasoning-delta')).toBe(true));
        const entry = globalRunRegistry.get(stream.runId)!;
        const admissions = await Promise.all([
          agent.sendSignal({ type: 'user', contents: 'SIGNAL_MARKER_A' }, scope),
          agent.sendSignal({ type: 'user', contents: 'SIGNAL_MARKER_B' }, scope),
        ]);
        for (const admission of admissions)
          await expect(admission.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
        await vi.waitFor(() => expect(providerAborted).toBe(true));
        await consumption;
        await entry.workflowExecution;
        expect(prompts).toHaveLength(2);
        const replacement = JSON.stringify(prompts[1]);
        for (const marker of ['SIGNAL_MARKER_A', 'SIGNAL_MARKER_B'])
          expect(replacement.match(new RegExp(marker, 'g'))).toHaveLength(1);
        for (const marker of ['STALE_REASONING_FINGERPRINT', 'STALE_SIGNATURE', 'STALE_ITEM_ID', 'STALE_ENCRYPTED'])
          expect(replacement).not.toContain(marker);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(false);
        expect(runController.signal.aborted).toBe(false);
        expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
        expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(1);
        expect(chunks.some(chunk => chunk.type === 'abort' || chunk.type === 'error')).toBe(false);
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(onAbort).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onStepFinish).toHaveBeenCalledTimes(1);
        expect(await stream.output.text).toBe('replacement answer');
        await vi.waitFor(async () =>
          expect((await memory.recall(scope)).messages.some(message => message.role === 'assistant')).toBe(true),
        );
        const history = JSON.stringify((await memory.recall(scope)).messages);
        for (const marker of ['STALE_REASONING_FINGERPRINT', 'STALE_SIGNATURE', 'STALE_ITEM_ID', 'STALE_ENCRYPTED'])
          expect(history).not.toContain(marker);
        expect(history).toContain('SIGNAL_MARKER_A');
        expect(history).toContain('SIGNAL_MARKER_B');
        if (phase === 'reasoning') expect(chunks.filter(chunk => chunk.type === 'reasoning-end')).toHaveLength(1);
        if (engine !== 'durable') {
          expect((agent.getWorkflow() as { engineType?: string }).engineType).toBe('evented');
          expect(events).toContain('workflow.start');
          expect(events.some(type => type.startsWith('workflow.step'))).toBe(true);
        }
      } finally {
        stream.abort();
        await consumption.catch(() => {});
        await globalRunRegistry.get(stream.runId)?.workflowExecution;
        stream.cleanup();
        await customPubsub?.close();
      }
    },
    15_000,
  );

  it('drops discarded frames delivered after publish resolves without output processors', async () => {
    // A new stream subscribes with replay, so the caching transport's index watermark drops
    // frames that arrive after later ones were already delivered. History never sees them:
    // persistence happens in the step, which discarded them.
    const transport = new DelayedReasoningPubSub();
    const replacement = barrier();
    const prompts: unknown[] = [];
    const memory = new MockMemory();
    const onFinish = vi.fn();
    const onAbort = vi.fn();
    const { agent, customPubsub } = createOwner(
      engine,
      {
        id: crypto.randomUUID(),
        name: 'Delayed delivery',
        instructions: 'Test',
        memory,
        model: new MockLanguageModelV2({
          doStream: async ({ prompt, abortSignal }) => {
            prompts.push(prompt);
            if (prompts.length > 1) {
              await replacement.promise;
              return { warnings: [], stream: convertArrayToReadableStream(answer()) };
            }
            return {
              warnings: [],
              stream: new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'reasoning-start', id: 'delayed' });
                  controller.enqueue({ type: 'reasoning-delta', id: 'delayed', delta: 'DELAYED_DISCARDED' });
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: 'delayed',
                    providerMetadata: { anthropic: { signature: 'DELAYED_SIGNATURE' } },
                  });
                  abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                },
              }),
            };
          },
        }),
      },
      undefined,
      transport,
    );
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
      onFinish,
      onAbort,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(transport.pending).toHaveLength(3));
      expect(chunks.some(chunk => chunk.type.startsWith('reasoning-'))).toBe(false);
      await (
        await agent.sendSignal({ type: 'user', contents: 'DELAYED_SIGNAL' }, scope)
      ).accepted;
      await vi.waitFor(() => expect(prompts).toHaveLength(2));
      await transport.deliverPending();
      replacement.release();
      await consumption;
      await entry.workflowExecution;
      expect(chunks.some(chunk => chunk.type.startsWith('reasoning-'))).toBe(false);
      expect(JSON.stringify(chunks)).not.toContain('DELAYED_SIGNATURE');
      expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(1);
      expect(chunks.filter(chunk => chunk.type === 'data-user-message')).toHaveLength(1);
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onAbort).not.toHaveBeenCalled();
      const history = JSON.stringify((await memory.recall(scope)).messages);
      expect(history).not.toContain('DELAYED_DISCARDED');
      expect(history).not.toContain('DELAYED_SIGNATURE');
      expect(history).toContain('replacement answer');
      expect(JSON.stringify(prompts[1])).toContain('DELAYED_SIGNAL');
    } finally {
      replacement.release();
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('supplies only accepted replacement input to the built-in structuring processor', async () => {
    const prompts: unknown[] = [];
    const structuringPrompts: unknown[] = [];
    const memory = new MockMemory();
    const structure = new StructuredOutputProcessor({
      schema: z.object({ answer: z.string() }),
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          structuringPrompts.push(prompt);
          return {
            warnings: [],
            stream: convertArrayToReadableStream(
              answer().map(part =>
                part.type === 'text-delta'
                  ? { ...part, delta: JSON.stringify({ answer: 'replacement answer' }) }
                  : part,
              ),
            ),
          };
        },
      }),
    });
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Structured cleanup',
      instructions: 'Test',
      memory,
      outputProcessors: [structure],
      model: new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          if (prompts.length > 1) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'discarded' });
                controller.enqueue({ type: 'reasoning-delta', id: 'discarded', delta: 'STRUCTURE_DISCARDED' });
                abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
              },
            }),
          };
        },
      }),
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(chunks.some(chunk => chunk.type === 'reasoning-delta')).toBe(true));
      expect(structuringPrompts).toHaveLength(0);
      await (
        await agent.sendSignal({ type: 'user', contents: 'STRUCTURE_SIGNAL' }, scope)
      ).accepted;
      await consumption;
      await entry.workflowExecution;
      expect(prompts).toHaveLength(2);
      expect(structuringPrompts).toHaveLength(1);
      expect(JSON.stringify(structuringPrompts)).not.toContain('STRUCTURE_DISCARDED');
      expect(JSON.stringify(structuringPrompts)).toContain('replacement answer');
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
      expect(JSON.stringify((await memory.recall(scope)).messages)).not.toContain('STRUCTURE_DISCARDED');
    } finally {
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('keeps transcript ordinals and tool results separate from discarded attempts', async () => {
    let calls = 0;
    let toolCalls = 0;
    const prompts: unknown[] = [];
    const snapshots: { ordinal: number; contents: string[] }[] = [];
    const memory = new MockMemory();
    const onStepFinish = vi.fn();
    const onAbort = vi.fn();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Transcript ordinals',
      instructions: 'Test',
      memory,
      tools: {
        counter: createTool({
          id: 'counter',
          description: 'Count',
          inputSchema: z.object({}),
          outputSchema: z.string(),
          execute: async () => `TOOL_COMPLETED_${++toolCalls}`,
        }),
      },
      inputProcessors: [
        {
          id: 'ordinals',
          processInputStep({ stepNumber, steps }) {
            snapshots.push({
              ordinal: stepNumber,
              contents: steps.map(step =>
                JSON.stringify({ text: step.text, toolCalls: step.toolCalls, toolResults: step.toolResults }),
              ),
            });
          },
        },
      ],
      model: new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          calls++;
          if (calls === 2)
            return {
              warnings: [],
              stream: new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'reasoning-start', id: 'discarded' });
                  controller.enqueue({ type: 'reasoning-delta', id: 'discarded', delta: 'ORDINAL_DISCARDED' });
                  abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                },
              }),
            };
          if (calls === 4) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
          return {
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: `accepted-${calls}` },
              { type: 'text-delta', id: `accepted-${calls}`, delta: `ACCEPTED_${calls}` },
              { type: 'text-end', id: `accepted-${calls}` },
              { type: 'tool-call', toolCallId: `tool-${calls}`, toolName: 'counter', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
              },
            ]),
          };
        },
      }),
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 4,
      onStepFinish,
      onAbort,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(chunks.some(chunk => chunk.type === 'reasoning-delta')).toBe(true));
      await (
        await agent.sendSignal({ type: 'user', contents: 'ORDINAL_SIGNAL' }, scope)
      ).accepted;
      await consumption;
      await entry.workflowExecution;
      expect(prompts).toHaveLength(4);
      expect(toolCalls).toBe(2);
      expect(snapshots.map(snapshot => snapshot.ordinal)).toEqual([0, 1, 1, 2]);
      expect(snapshots[2]?.contents).toHaveLength(1);
      expect(snapshots[2]?.contents[0]).toContain('TOOL_COMPLETED_1');
      expect(snapshots[3]?.contents).toHaveLength(2);
      expect(snapshots[3]?.contents[0]).toContain('TOOL_COMPLETED_1');
      expect(snapshots[3]?.contents[1]).toContain('TOOL_COMPLETED_2');
      expect(onStepFinish).toHaveBeenCalledTimes(3);
      expect(onStepFinish.mock.calls[1]?.[0].text).toBe('ACCEPTED_3');
      expect(onStepFinish.mock.calls[2]?.[0].text).toBe('replacement answer');
      expect(JSON.stringify(prompts[2])).not.toContain('ORDINAL_DISCARDED');
      expect(JSON.stringify((await memory.recall(scope)).messages)).not.toContain('ORDINAL_DISCARDED');
      expect(onAbort).not.toHaveBeenCalled();
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
    } finally {
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('waits for an in-flight processor before the replacement request', async () => {
    const held = barrier();
    let processing = false;
    let providerAborted = false;
    const prompts: unknown[] = [];
    const memory = new MockMemory();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Processor barrier',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          if (prompts.length > 1) return { stream: convertArrayToReadableStream(answer()), warnings: [] };
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'held' });
                controller.enqueue({ type: 'reasoning-delta', id: 'held', delta: 'STALE_PROCESSOR_REASONING' });
                abortSignal?.addEventListener(
                  'abort',
                  () => {
                    providerAborted = true;
                    controller.error(abortSignal.reason);
                  },
                  { once: true },
                );
              },
            }),
          };
        },
      }),
      outputProcessors: [
        {
          id: 'held-processor',
          async processOutputStream({ part }) {
            if (part.type !== 'reasoning-delta') return part;
            processing = true;
            await held.promise;
            return part;
          },
        },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(processing).toBe(true));
      await (
        await agent.sendSignal({ type: 'user', contents: 'PROCESSOR_REPLACEMENT' }, scope)
      ).accepted;
      await vi.waitFor(() => expect(providerAborted).toBe(true));
      // Give a replacement started too early time to show up.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(prompts).toHaveLength(1);
      held.release();
      await consumption;
      await entry.workflowExecution;
      expect(prompts).toHaveLength(2);
      expect(JSON.stringify(prompts[1])).toContain('PROCESSOR_REPLACEMENT');
      expect(JSON.stringify(prompts[1])).not.toContain('STALE_PROCESSOR_REASONING');
      expect(JSON.stringify((await memory.recall(scope)).messages)).not.toContain('STALE_PROCESSOR_REASONING');
      expect(chunks.some(chunk => chunk.type === 'error' || chunk.type === 'abort')).toBe(false);
      expect(await stream.output.text).toBe('replacement answer');
      expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(1);
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
    } finally {
      held.release();
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('preempts during input processing without resetting state or dropping processor signals', async () => {
    const held = barrier();
    let processing = false;
    const processorSignals: (AbortSignal | undefined)[] = [];
    const ordinals: number[] = [];
    const stateCounts: number[] = [];
    const prompts: unknown[] = [];
    const memory = new MockMemory();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Input barrier',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          return { stream: convertArrayToReadableStream(answer()), warnings: [] };
        },
      }),
      inputProcessors: [
        {
          id: 'input-barrier',
          async processInputStep({ state, stepNumber, sendSignal, abortSignal }) {
            processorSignals.push(abortSignal);
            state.count = (state.count ?? 0) + 1;
            ordinals.push(stepNumber);
            stateCounts.push(state.count);
            if (state.count === 1) {
              processing = true;
              await held.promise;
              sendSignal({ type: 'reactive', contents: 'PROCESSOR_HISTORY', prompt: 'PROCESSOR_HISTORY' });
            }
          },
        },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(processing).toBe(true));
      await (
        await agent.sendSignal({ type: 'user', contents: 'QUEUED_INPUT' }, scope)
      ).accepted;
      expect(prompts).toHaveLength(0);
      held.release();
      await consumption;
      await entry.workflowExecution;
      expect(prompts).toHaveLength(1);
      expect(JSON.stringify(prompts[0])).toContain('QUEUED_INPUT');
      expect(JSON.stringify(prompts[0])).toContain('PROCESSOR_HISTORY');
      expect(ordinals).toEqual([0, 0]);
      expect(stateCounts).toEqual([1, 2]);
      // The interruption cancels only the model request, never the processors preparing it.
      expect(processorSignals.some(signal => signal?.aborted)).toBe(false);
      const echoes = chunks.filter(chunk => chunk.type === 'data-signal');
      expect(JSON.stringify(echoes).match(/PROCESSOR_HISTORY/g)).toHaveLength(1);
      const history = JSON.stringify((await memory.recall({ ...scope, hideSignals: false })).messages);
      expect(history).toContain('PROCESSOR_HISTORY');
      expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(1);
    } finally {
      held.release();
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('adds a signal queued after the loop drain to the next request', async () => {
    const prompts: unknown[] = [];
    const memory = new MockMemory();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Between steps',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          if (prompts.length > 1) return { stream: convertArrayToReadableStream(answer()), warnings: [] };
          return {
            stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'probe', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
            warnings: [],
          };
        },
      }),
      tools: {
        probe: createTool({ id: 'probe', description: 'Probe', inputSchema: z.object({}), execute: async () => 'ok' }),
      },
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
      // Runs after the loop drained signals and before the next step subscribes.
      onIterationComplete: async ({ isFinal }: { isFinal: boolean }) => {
        if (!isFinal) await (await agent.sendSignal({ type: 'user', contents: 'GAP_SIGNAL' }, scope)).accepted;
      },
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    try {
      await collect(stream.fullStream);
      await entry.workflowExecution;
      expect(prompts).toHaveLength(2);
      expect(JSON.stringify(prompts[1])).toContain('GAP_SIGNAL');
    } finally {
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('retries one logical step beyond processor retry limits with no interruption cap or usage charge', async () => {
    const prompts: unknown[] = [];
    const providerSignals: AbortSignal[] = [];
    const requestOrdinals: number[] = [];
    const requestRetryCounts: number[] = [];
    const requestStepCounts: number[] = [];
    const onStepFinish = vi.fn();
    const onIterationComplete = vi.fn();
    const memory = new MockMemory();
    const onFinish = vi.fn();
    const onError = vi.fn();
    const onAbort = vi.fn();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Budget',
      instructions: 'Test',
      memory,
      inputProcessors: [
        {
          id: 'logical-accounting',
          processLLMRequest({ prompt, stepNumber, retryCount, steps }) {
            requestOrdinals.push(stepNumber);
            requestRetryCounts.push(retryCount);
            requestStepCounts.push(steps.length);
            return { prompt };
          },
        },
      ],
      model: new MockLanguageModelV2({
        doStream: async ({ prompt, abortSignal }) => {
          prompts.push(prompt);
          if (!abortSignal) throw new Error('Expected abort signal');
          providerSignals.push(abortSignal);
          if (prompts.length === 6) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
          await new Promise((_, reject) =>
            abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
          );
          throw new Error('Unreachable');
        },
      }),
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 1,
      onFinish,
      onError,
      onAbort,
      onStepFinish,
      onIterationComplete,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      for (let index = 0; index < 5; index++) {
        await vi.waitFor(() => expect(prompts).toHaveLength(index + 1));
        await (
          await agent.sendSignal({ type: 'user', contents: `BUDGET_SIGNAL_${index}` }, scope)
        ).accepted;
        await vi.waitFor(() => expect(providerSignals[index]?.aborted).toBe(true));
      }
      await consumption;
      await entry.workflowExecution;
      expect(prompts).toHaveLength(6);
      for (let index = 0; index < 5; index++)
        expect(JSON.stringify(prompts[index + 1])).toContain(`BUDGET_SIGNAL_${index}`);
      expect(requestOrdinals).toEqual([0, 0, 0, 0, 0, 0]);
      expect(requestRetryCounts).toEqual(requestOrdinals);
      expect(requestStepCounts).toEqual(requestOrdinals);
      expect(onStepFinish).toHaveBeenCalledTimes(1);
      expect(onIterationComplete).toHaveBeenCalledTimes(1);
      expect(onIterationComplete.mock.calls[0]?.[0]).toMatchObject({ iteration: 1, text: 'replacement answer' });
      expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(1);
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
      expect(onAbort).not.toHaveBeenCalled();
      const history = JSON.stringify((await memory.recall(scope)).messages);
      expect(history).toContain('BUDGET_SIGNAL_0');
      expect(history).toContain('BUDGET_SIGNAL_1');
      expect(history).toContain('BUDGET_SIGNAL_4');
      expect((await memory.recall(scope)).messages.filter(message => message.role === 'assistant')).toHaveLength(1);
      const steps = await stream.output.steps;
      expect(steps).toHaveLength(1);
      expect(steps[0]?.text).toBe('replacement answer');
      expect(await stream.output.totalUsage).toMatchObject({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
      stream.cleanup();
    } finally {
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it.each(
    (['caller', 'timeout'] as const).flatMap(cancellation =>
      [false, true].map(priorAccepted => ({ cancellation, priorAccepted })),
    ),
  )(
    'keeps discarded output empty with prior accepted=$priorAccepted when $cancellation cancellation wins while a processor settles',
    async ({ cancellation, priorAccepted }) => {
      const held = barrier();
      let requestSignal: AbortSignal | undefined;
      let processing = false;
      let toolCalls = 0;
      const prompts: unknown[] = [];
      const memory = new MockMemory();
      const onFinish = vi.fn();
      const onAbort = vi.fn();
      const onError = vi.fn();
      const onStepFinish = vi.fn();
      const goalScorer = createScorer({ id: 'cancellation-goal', name: 'Cancellation Goal' }).generateScore(() => 1);
      const judge = vi.spyOn(goalScorer, 'run');
      const { agent, customPubsub } = createOwner(engine, {
        id: crypto.randomUUID(),
        name: 'Cancellation race',
        goal: { judge: 'mock-judge', scorer: goalScorer, maxRuns: 5 },
        instructions: 'Test',
        memory,
        tools: {
          counter: createTool({
            id: 'counter',
            description: 'Count',
            inputSchema: z.object({}),
            outputSchema: z.object({ calls: z.number() }),
            execute: async () => ({ calls: ++toolCalls }),
          }),
        },
        model: new MockLanguageModelV2({
          doStream: async ({ prompt, abortSignal }) => {
            prompts.push(prompt);
            requestSignal = abortSignal;
            if (priorAccepted && prompts.length === 1)
              return {
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 'earlier' },
                  { type: 'text-delta', id: 'earlier', delta: 'EARLIER_ACCEPTED' },
                  { type: 'text-end', id: 'earlier' },
                  { type: 'tool-call', toolCallId: 'earlier-tool', toolName: 'counter', input: '{}' },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
                  },
                ]),
              };
            if (prompts.length > 2) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
            return {
              warnings: [],
              stream: new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'reasoning-start', id: 'race' });
                  controller.enqueue({ type: 'reasoning-delta', id: 'race', delta: 'VISIBLE_DISCARDED' });
                  controller.enqueue({ type: 'reasoning-delta', id: 'race', delta: 'HELD_DISCARDED' });
                  abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                },
              }),
            };
          },
        }),
        outputProcessors: [
          {
            id: 'settling',
            async processOutputStream({ part }) {
              if (part.type === 'reasoning-delta' && part.payload.text === 'HELD_DISCARDED') {
                processing = true;
                await held.promise;
              }
              return part;
            },
          },
        ],
      });
      const controller = new AbortController();
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      await agent.setObjective('Keep the objective active without judging cancelled work', scope);
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 4,
        abortSignal: controller.signal,
        modelSettings: cancellation === 'timeout' ? { timeout: { totalMs: 1_200 } } : undefined,
        onFinish,
        onAbort,
        onError,
        onStepFinish,
      });
      const entry = globalRunRegistry.get(stream.runId)!;
      const chunks: ChunkType[] = [];
      const consumption = collect(stream.fullStream, chunks);
      try {
        await vi.waitFor(() => expect(processing).toBe(true));
        const queued = await agent.sendSignal({ type: 'user', contents: 'CANCEL_RACE_SIGNAL' }, scope);
        await queued.accepted;
        await vi.waitFor(() => expect(requestSignal?.aborted).toBe(true));
        // Isolate this run's cancellation from the existing queued-message follow-up routing.
        expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] }).cancelledSignalIds).toEqual([
          queued.signal.id,
        ]);
        if (cancellation === 'caller') controller.abort();
        await vi.waitFor(() => expect(entry.abortSignal?.aborted).toBe(true), { timeout: 2_500 });
        expect(prompts).toHaveLength(priorAccepted ? 2 : 1);
        held.release();
        await consumption;
        await entry.workflowExecution;
        expect(prompts).toHaveLength(priorAccepted ? 2 : 1);
        expect(toolCalls).toBe(priorAccepted ? 1 : 0);
        expect(onStepFinish).toHaveBeenCalledTimes(priorAccepted ? 1 : 0);
        if (priorAccepted)
          expect(onStepFinish.mock.calls[0]?.[0]).toMatchObject({
            text: 'EARLIER_ACCEPTED',
            usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          });
        expect(judge).not.toHaveBeenCalled();
        expect(await agent.getObjective({ threadId: scope.threadId })).toMatchObject({ status: 'active', runsUsed: 0 });
        expect(chunks.filter(chunk => chunk.type === 'goal')).toHaveLength(0);
        const history = JSON.stringify((await memory.recall(scope)).messages);
        if (priorAccepted) {
          expect(history).toContain('EARLIER_ACCEPTED');
          expect(history).toContain('earlier-tool');
        } else {
          expect((await memory.recall(scope)).messages.filter(message => message.role === 'assistant')).toHaveLength(0);
        }
        expect(history).not.toContain('VISIBLE_DISCARDED');
        expect(history).not.toContain('HELD_DISCARDED');
        expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(priorAccepted ? 1 : 0);
        expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
        expect(onFinish).not.toHaveBeenCalled();
        expect(chunks.filter(chunk => chunk.type === 'abort')).toHaveLength(cancellation === 'caller' ? 1 : 0);
        expect(onAbort).toHaveBeenCalledTimes(cancellation === 'caller' ? 1 : 0);
        expect(onError).toHaveBeenCalledTimes(cancellation === 'timeout' ? 1 : 0);
        const finish = chunks.find(chunk => chunk.type === 'finish');
        expect(finish?.payload.stepResult.reason).toBe(cancellation === 'caller' ? 'abort' : 'error');
        const totals = await stream.output.totalUsage;
        if (priorAccepted) expect(totals).toMatchObject({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
        else expect(Object.values(totals).every(value => value === undefined || value === 0)).toBe(true);
        expect(await stream.output.steps).toHaveLength(priorAccepted ? 1 : 0);
      } finally {
        held.release();
        stream.abort();
        await consumption.catch(() => {});
        await entry.workflowExecution;
        stream.cleanup();
        await customPubsub?.close();
      }
    },
    10_000,
  );

  it.each(['transformed', 'suppressed'] as const)(
    'closes only reasoning the client saw open when a processor %s it',
    async outcome => {
      let calls = 0;
      let endInvocations = 0;
      let processedDelta = false;
      const { agent, customPubsub } = createOwner(engine, {
        id: crypto.randomUUID(),
        name: 'Transformed reasoning',
        instructions: 'Test',
        memory: new MockMemory(),
        model: new MockLanguageModelV2({
          doStream: async ({ abortSignal }) => {
            if (++calls > 1) return { stream: convertArrayToReadableStream(answer()), warnings: [] };
            return {
              warnings: [],
              stream: new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'reasoning-start', id: 'raw' });
                  controller.enqueue({ type: 'reasoning-delta', id: 'raw', delta: 'discarded' });
                  abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
                },
              }),
            };
          },
        }),
        outputProcessors: [
          {
            id: 'prefix-reasoning',
            processOutputStream({ part }) {
              if (part.type === 'reasoning-end') {
                endInvocations++;
                return null;
              }
              if (part.type !== 'reasoning-start' && part.type !== 'reasoning-delta') return part;
              if (part.type === 'reasoning-delta') processedDelta = true;
              if (outcome === 'suppressed') return null;
              return { ...part, payload: { ...part.payload, id: `visible:${part.payload.id}` } } as typeof part;
            },
          },
        ],
      });
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 3,
      });
      const entry = globalRunRegistry.get(stream.runId)!;
      const chunks: ChunkType[] = [];
      const consumption = collect(stream.fullStream, chunks);
      try {
        await vi.waitFor(() => expect(processedDelta).toBe(true));
        await (
          await agent.sendSignal({ type: 'user', contents: 'CLOSE_VISIBLE_REASONING' }, scope)
        ).accepted;
        await consumption;
        await entry.workflowExecution;
        const starts = chunks.filter(chunk => chunk.type === 'reasoning-start');
        const ends = chunks.filter(chunk => chunk.type === 'reasoning-end');
        expect(ends.map(chunk => chunk.payload.id)).toEqual(starts.map(chunk => chunk.payload.id));
        expect(starts).toHaveLength(outcome === 'transformed' ? 1 : 0);
        expect(endInvocations).toBe(0);
        expect(ends[0]?.payload.providerMetadata).toBeUndefined();
      } finally {
        stream.abort();
        await consumption.catch(() => {});
        await entry.workflowExecution;
        stream.cleanup();
        await customPubsub?.close();
      }
    },
  );

  it('preserves terminal timeout with the interrupting signal still queued', async () => {
    const held = barrier();
    let processing = false;
    let requests = 0;
    let queuedSignalId: string | undefined;
    let requestSignal: AbortSignal | undefined;
    const onError = vi.fn();
    const onStepFinish = vi.fn();
    const memory = new MockMemory();
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Queued timeout precedence',
      instructions: 'Test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async ({ abortSignal }) => {
          if (++requests > 1) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
          requestSignal = abortSignal;
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'queued-timeout' });
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: 'queued-timeout',
                  delta: 'QUEUED_TIMEOUT_DISCARDED',
                });
                abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
              },
            }),
          };
        },
      }),
      outputProcessors: [
        {
          id: 'timeout-settlement',
          async processOutputStream({ part }) {
            if (part.type === 'reasoning-delta') {
              processing = true;
              await held.promise;
            }
            return part;
          },
        },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 1,
      modelSettings: { timeout: { totalMs: 1200 } },
      onError,
      onStepFinish,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      await vi.waitFor(() => expect(processing).toBe(true));
      const queued = await agent.sendSignal({ type: 'user', contents: 'QUEUED_TIMEOUT_SIGNAL' }, scope);
      queuedSignalId = queued.signal.id;
      await queued.accepted;
      await vi.waitFor(() => expect(requestSignal?.aborted).toBe(true));
      const drain = vi.fn(entry.drainPendingSignals);
      entry.drainPendingSignals = drain;
      await vi.waitFor(() => expect(entry.abortSignal?.aborted).toBe(true), { timeout: 2500 });
      held.release();
      await consumption;
      await entry.workflowExecution;
      expect(drain).not.toHaveBeenCalled();
      expect(chunks.filter(chunk => chunk.type === 'error')).toHaveLength(1);
      expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
      expect(chunks.find(chunk => chunk.type === 'finish')?.payload.stepResult.reason).toBe('error');
      expect(chunks.filter(chunk => chunk.type === 'step-finish')).toHaveLength(0);
      expect(onStepFinish).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(await stream.output.steps).toHaveLength(0);
    } finally {
      if (queuedSignalId) agent.cancelQueuedMessages({ ...scope, signalIds: [queuedSignalId] });
      held.release();
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it('preempts a fallback without inheriting failed primary usage or consuming processor retries', async () => {
    const prompts: unknown[] = [];
    let primaryCalls = 0;
    let started = false;
    const initialFailure = barrier();
    const onStepFinish = vi.fn();
    const memory = new MockMemory();
    const primary = new MockLanguageModelV2({
      modelId: 'primary',
      doStream: async () => {
        primaryCalls++;
        return {
          warnings: [],
          request: { body: 'PRIMARY_REQUEST' },
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'finish', finishReason: 'other', usage: { inputTokens: 77, outputTokens: 1, totalTokens: 78 } },
          ]),
        };
      },
    });
    const fallback = new MockLanguageModelV2({
      modelId: 'fallback',
      doStream: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        if (prompts.length > 1) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
        return {
          warnings: [],
          stream: new ReadableStream<LanguageModelV2StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'reasoning-start', id: 'fallback' });
              controller.enqueue({ type: 'reasoning-delta', id: 'fallback', delta: 'FALLBACK_DISCARDED' });
              abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
              started = true;
            },
          }),
        };
      },
    });
    const { agent, customPubsub } = createOwner(engine, {
      id: crypto.randomUUID(),
      name: 'Fallback interruption',
      instructions: 'Test',
      memory,
      model: [
        { model: primary, maxRetries: 0 },
        { model: fallback, maxRetries: 0 },
      ],
      errorProcessors: [
        {
          id: 'primary-error',
          async processAPIError({ retryCount }) {
            expect(retryCount).toBe(0);
            await initialFailure.promise;
          },
        },
      ],
    });
    const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
    const stream = await agent.stream('initial question', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 3,
      onStepFinish,
    });
    const entry = globalRunRegistry.get(stream.runId)!;
    const chunks: ChunkType[] = [];
    const consumption = collect(stream.fullStream, chunks);
    try {
      initialFailure.release();
      await vi.waitFor(() => expect(started).toBe(true));
      await vi.waitFor(() => expect(chunks.some(chunk => chunk.type === 'reasoning-delta')).toBe(true));
      await (
        await agent.sendSignal({ type: 'user', contents: 'FALLBACK_SIGNAL' }, scope)
      ).accepted;
      await consumption;
      await entry.workflowExecution;
      expect(primaryCalls).toBe(2);
      expect(prompts).toHaveLength(2);
      expect(onStepFinish).toHaveBeenCalledTimes(1);
      expect(onStepFinish.mock.calls[0]?.[0].usage.inputTokens).toBe(5);
      expect(await stream.output.totalUsage).toMatchObject({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
      expect(JSON.stringify(prompts[1])).toContain('FALLBACK_SIGNAL');
      expect(JSON.stringify(prompts[1])).not.toContain('FALLBACK_DISCARDED');
      expect(JSON.stringify((await memory.recall(scope)).messages)).not.toContain('FALLBACK_DISCARDED');
      expect(chunks.some(chunk => chunk.type === 'error' || chunk.type === 'abort')).toBe(false);
    } finally {
      stream.abort();
      await consumption.catch(() => {});
      await entry.workflowExecution;
      stream.cleanup();
      await customPubsub?.close();
    }
  });

  it.each(['provider', 'cached'] as const)(
    'accepts completed %s reasoning before publishing the step',
    async source => {
      let requestSignal: AbortSignal | undefined;
      const held = barrier();
      const completed = barrier();
      let requests = 0;
      const prompts: unknown[] = [];
      const memory = new MockMemory();
      const onStepFinish = vi.fn();
      const { agent, customPubsub } = createOwner(engine, {
        id: crypto.randomUUID(),
        name: 'Accepted reasoning',
        instructions: 'Test',
        memory,
        model: new MockLanguageModelV2({
          doStream: async ({ prompt, abortSignal }) => {
            prompts.push(prompt);
            requestSignal ??= abortSignal;
            return {
              warnings: [],
              stream: convertArrayToReadableStream(
                source === 'provider' && prompts.length === 1
                  ? [
                      { type: 'stream-start', warnings: [] },
                      { type: 'reasoning-start', id: 'completed' },
                      { type: 'reasoning-delta', id: 'completed', delta: 'ACCEPTED_REASONING' },
                      {
                        type: 'reasoning-end',
                        id: 'completed',
                        providerMetadata: { anthropic: { signature: 'ACCEPTED_SIGNATURE' } },
                      },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                      },
                    ]
                  : answer(),
              ),
            };
          },
        }),
        inputProcessors: [
          {
            id: 'cache',
            processLLMRequest() {
              requests++;
              if (source !== 'cached' || requests !== 1) return;
              return {
                response: {
                  chunks: [
                    { type: 'reasoning-start', payload: { id: 'completed' } },
                    { type: 'reasoning-delta', payload: { id: 'completed', text: 'ACCEPTED_REASONING' } },
                    {
                      type: 'reasoning-end',
                      payload: {
                        id: 'completed',
                        providerMetadata: { anthropic: { signature: 'ACCEPTED_SIGNATURE' } },
                      },
                    },
                    {
                      type: 'finish',
                      payload: {
                        stepResult: { reason: 'stop', warnings: [], isContinued: false },
                        output: {
                          text: '',
                          toolCalls: [],
                          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                        },
                        metadata: { modelId: 'mock-model', request: {} },
                      },
                    },
                  ],
                },
              };
            },
          },
        ],
        outputProcessors: [
          {
            id: 'hold-completed-step',
            async processOutputStep({ messages, stepNumber }) {
              if (stepNumber === 0) {
                completed.release();
                await held.promise;
              }
              return messages;
            },
          },
        ],
      });
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 3,
        onStepFinish,
      });
      const entry = globalRunRegistry.get(stream.runId)!;
      const chunks: ChunkType[] = [];
      const consumption = collect(stream.fullStream, chunks);
      try {
        await completed.promise;
        await (
          await agent.sendSignal({ type: 'user', contents: 'AFTER_COMPLETION_SIGNAL' }, scope)
        ).accepted;
        expect(requestSignal?.aborted).not.toBe(true);
        held.release();
        await consumption;
        await entry.workflowExecution;
        expect(requests).toBe(2);
        expect(prompts).toHaveLength(source === 'cached' ? 1 : 2);
        expect(JSON.stringify(prompts.at(-1))).toContain('AFTER_COMPLETION_SIGNAL');
        expect(JSON.stringify(prompts.at(-1))).toContain('ACCEPTED_REASONING');
        expect(JSON.stringify(prompts.at(-1))).toContain('ACCEPTED_SIGNATURE');
        expect(JSON.stringify((await memory.recall(scope)).messages)).toContain('ACCEPTED_REASONING');
        expect(onStepFinish.mock.calls[0]?.[0].reasoningText).toBe('ACCEPTED_REASONING');
        expect(chunks.some(chunk => chunk.type === 'error' || chunk.type === 'abort')).toBe(false);
      } finally {
        held.release();
        stream.abort();
        await consumption.catch(() => {});
        await entry.workflowExecution;
        stream.cleanup();
        await customPubsub?.close();
      }
    },
  );

  it.each(['text', 'tool'] as const)(
    'protects raw %s boundaries while a processor delays and suppresses them',
    async boundary => {
      const held = barrier();
      let processing = false;
      let toolCalls = 0;
      const prompts: unknown[] = [];
      const signals: AbortSignal[] = [];
      const memory = new MockMemory();
      const { agent, customPubsub } = createOwner(engine, {
        id: crypto.randomUUID(),
        name: 'Protected boundary',
        instructions: 'Test',
        memory,
        tools: {
          counter: createTool({
            id: 'counter',
            description: 'Count',
            inputSchema: z.object({}),
            outputSchema: z.string(),
            execute: async () => {
              toolCalls++;
              return 'TOOL_COMPLETED_ONCE';
            },
          }),
        },
        model: new MockLanguageModelV2({
          doStream: async ({ prompt, abortSignal }) => {
            prompts.push(prompt);
            if (!abortSignal) throw new Error('Expected abort signal');
            signals.push(abortSignal);
            if (prompts.length > 1) return { warnings: [], stream: convertArrayToReadableStream(answer()) };
            return {
              warnings: [],
              stream: new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  if (boundary === 'text') controller.enqueue({ type: 'text-start', id: 'protected' });
                  else
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: 'protected-tool',
                      toolName: 'counter',
                      input: '{}',
                    });
                  void held.promise.then(() => {
                    if (boundary === 'text') {
                      controller.enqueue({ type: 'text-delta', id: 'protected', delta: 'PROTECTED_TEXT' });
                      controller.enqueue({ type: 'text-end', id: 'protected' });
                    }
                    controller.enqueue({
                      type: 'finish',
                      finishReason: boundary === 'tool' ? 'tool-calls' : 'stop',
                      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
                    });
                    controller.close();
                  });
                },
              }),
            };
          },
        }),
        outputProcessors: [
          {
            id: 'suppress-boundary',
            async processOutputStream({ part }) {
              if (part.type === (boundary === 'text' ? 'text-start' : 'tool-call')) {
                processing = true;
                await held.promise;
                return null;
              }
              return part;
            },
          },
        ],
      });
      const scope = { threadId: crypto.randomUUID(), resourceId: crypto.randomUUID() };
      const stream = await agent.stream('initial question', {
        memory: { thread: scope.threadId, resource: scope.resourceId },
        maxSteps: 3,
      });
      const entry = globalRunRegistry.get(stream.runId)!;
      const chunks: ChunkType[] = [];
      const consumption = collect(stream.fullStream, chunks);
      try {
        await vi.waitFor(() => expect(processing).toBe(true));
        await (
          await agent.sendSignal({ type: 'user', contents: 'PROTECTED_SIGNAL' }, scope)
        ).accepted;
        expect(signals[0]?.aborted).toBe(false);
        expect(prompts).toHaveLength(1);
        expect(toolCalls).toBe(0);
        held.release();
        await consumption;
        await entry.workflowExecution;
        expect(prompts).toHaveLength(2);
        expect(signals.every(signal => !signal.aborted)).toBe(true);
        expect(toolCalls).toBe(boundary === 'tool' ? 1 : 0);
        expect(JSON.stringify(prompts[1])).toContain('PROTECTED_SIGNAL');
        const retained = boundary === 'tool' ? 'TOOL_COMPLETED_ONCE' : 'PROTECTED_TEXT';
        expect(JSON.stringify(prompts[1])).toContain(retained);
        expect(JSON.stringify((await memory.recall(scope)).messages)).toContain(retained);
        expect(chunks.some(chunk => chunk.type === 'abort' || chunk.type === 'error')).toBe(false);
        expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
      } finally {
        held.release();
        stream.abort();
        await consumption.catch(() => {});
        await entry.workflowExecution;
        stream.cleanup();
        await customPubsub?.close();
      }
    },
  );
});
