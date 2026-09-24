/**
 * `subscribeToThread({ withInitialHistory })` while publishing lags behind the
 * model: parts must be judged by when they were produced, so nothing storage
 * already holds is sent again after the `thread-history` chunk.
 *
 * Shared so the same scenarios run on the in-memory test pubsub and on real
 * backends (see `@mastra/redis-streams`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import type { PubSub } from '../../events/pubsub';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { MessageHistory } from '../../processors/memory/message-history';
import type { MemoryStorage } from '../../storage';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';
import { nextTicks } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
let threadId = 'lag-thread';
const resourceId = 'lag-user';
const memoryOption = { thread: threadId, resource: resourceId };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

function streamOf(parts: any[]) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
      ...parts,
    ]),
  };
}

/**
 * Step 1 writes text and calls `tool` (twice with `siblings`); step 2 answers.
 * `beforeAnswer` holds step 2 back.
 */
function model(tool: string, beforeAnswer?: Promise<void>, siblings = false) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      if (!JSON.stringify(prompt).includes('"type":"tool-result"')) {
        return streamOf([
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'checking' },
          { type: 'text-end', id: 't1' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: tool, input: '{"q":"x"}' },
          ...(siblings ? [{ type: 'tool-call', toolCallId: 'call-2', toolName: tool, input: '{"q":"y"}' }] : []),
          { type: 'finish', finishReason: 'tool-calls', usage },
        ]);
      }
      await beforeAnswer;
      return streamOf([
        { type: 'text-start', id: 't2' },
        { type: 'text-delta', id: 't2', delta: 'answer' },
        { type: 'text-end', id: 't2' },
        { type: 'finish', finishReason: 'stop', usage },
      ]);
    },
  });
}

/** Saves the previous step at each step boundary, the way Observational Memory does. */
function stepSaver(store: InMemoryStore, onSaved?: () => void) {
  return {
    id: 'step-saver',
    processInputStep: async ({
      messageList,
      stepNumber,
    }: Parameters<NonNullable<Processor['processInputStep']>>[0]) => {
      if (stepNumber === 0) return;
      const history = new MessageHistory({ storage: (await store.getStore('memory')) as MemoryStorage });
      const messages = [...messageList.get.input.db(), ...messageList.get.response.db()];
      await history.persistMessages({ messages, threadId, resourceId });
      onSaved?.();
    },
  };
}

function setupAgent(options: {
  delayMs: number;
  tool: 'lookup' | 'echo';
  beforeAnswer?: Promise<void>;
  toolGate?: Promise<void>;
  onToolStart?: () => void;
  saveEachStep?: boolean;
  onStepSaved?: () => void;
  siblings?: boolean;
  durable?: boolean;
  pubsub: PubSub;
}): Agent<any, any, any, any> & { testPubsub: PubSub } {
  const pubsub = options.pubsub;
  const store = new InMemoryStore();
  const memory = new MockMemory({ storage: store });
  const execute = async () => {
    options.onToolStart?.();
    await options.toolGate;
    return { found: true };
  };
  const agent = new Agent({
    id: 'lag-agent',
    name: 'Lag Agent',
    instructions: 'test',
    model: model(options.tool, options.beforeAnswer, options.siblings),
    memory,
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'l',
        inputSchema: z.object({ q: z.string() }),
        requireApproval: true,
        execute,
      }),
      echo: createTool({ id: 'echo', description: 'e', inputSchema: z.object({ q: z.string() }), execute }),
    },
    inputProcessors: options.saveEachStep ? [stepSaver(store, options.onStepSaved)] : [],
  });
  if (options.durable) {
    const durable = createDurableAgent({ agent, pubsub });
    const mastra = new Mastra({ agents: { agent: durable }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent') as any;
    const stream = registered.stream.bind(registered);
    // Same shape as Agent.stream for the helpers below.
    // Close at a suspension like Agent.stream does, instead of staying open for the resume.
    registered.stream = async (messages: any, streamOptions: any) => {
      const result = await stream(messages, { ...streamOptions, closeOnSuspend: true });
      return Object.assign(result.output, { runId: result.runId });
    };
    return Object.assign(registered as Agent<any, any, any, any>, { testPubsub: pubsub });
  }
  const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
  return Object.assign(mastra.getAgent('agent') as Agent<any, any, any, any>, { testPubsub: pubsub });
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  const types: string[] = [];
  for await (const chunk of stream.fullStream) types.push(chunk.type);
  await nextTicks(20);
  return types;
}

/** Subscribe with history and collect chunk types until `until` settles. */
async function join(agent: Agent<any, any, any, any>, until: Promise<unknown> = nextTicks(20), lastType?: string) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
  const chunks: any[] = [];
  const consumed = (async () => {
    for await (const chunk of subscription.stream) chunks.push(chunk);
  })();
  await until;
  await nextTicks(20);
  if (lastType) await vi.waitFor(() => expect(chunks.at(-1)?.type).toBe(lastType));
  subscription.unsubscribe();
  await consumed;
  return chunks;
}

function historyParts(chunk: any): string[] {
  return (chunk.payload?.messages ?? []).flatMap((m: any) => (m.content?.parts ?? []).map((p: any) => p.type));
}

export interface PublishLagBackend {
  /** A pubsub whose `stream-part` publishes lag by `delayMs`. */
  create(delayMs: number): Promise<PubSub> | PubSub;
  /** Types of the `stream-part` events currently held on the thread topic. */
  topicParts(pubsub: PubSub, ids: { threadId: string; resourceId: string }): Promise<string[]> | string[];
  cleanup?(): Promise<void> | void;
}

export function definePublishLagSuite(name: string, backend: PublishLagBackend) {
  afterEach(async () => {
    agentThreadStreamRuntime.resetForTests();
    await backend.cleanup?.();
  });

  describe.each([
    [false, 0],
    [false, 5],
    [true, 0],
    [true, 5],
  ])(`${name}: thread history (durable=%s) with %i ms publish lag`, (durable, delayMs) => {
    let pubsub: PubSub;
    beforeEach(async () => {
      threadId = `lag-thread-${Math.random().toString(36).slice(2)}`;
      memoryOption.thread = threadId;
      pubsub = await backend.create(delayMs);
    });
    const setup = (options: Omit<Parameters<typeof setupAgent>[0], 'pubsub'>) => setupAgent({ ...options, pubsub });
    const topicParts = () => backend.topicParts(pubsub, { threadId, resourceId });
    it('reconnecting to a run waiting on approval delivers only the approval', async () => {
      const agent = setup({ durable, delayMs, tool: 'lookup' });
      await drain(await agent.stream('go', { memory: memoryOption }));

      expect((await join(agent)).map(c => c.type)).toEqual(['thread-history', 'tool-call-approval']);
    });

    it('joining while an approved run resumes sends neither step 1 nor the answered approval', async () => {
      const toolGate = deferred();
      const toolStarted = deferred();
      const agent = setup({
        durable,
        delayMs,
        tool: 'lookup',
        toolGate: toolGate.promise,
        onToolStart: toolStarted.resolve,
      });
      const first = await agent.stream('go', { memory: memoryOption });
      await drain(first);

      const resumed = drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));
      await toolStarted.promise;
      const chunks = join(
        agent,
        resumed.then(() => undefined),
        'finish',
      );
      await nextTicks(20);
      toolGate.resolve();
      const types = (await chunks).map(c => c.type);

      expect(types[0]).toBe('thread-history');
      // The resumed half opens with its own `start`, ahead of its parts.
      expect(types.filter(t => t === 'start')).toHaveLength(1);
      expect(types.indexOf('start')).toBeLessThan(types.indexOf('tool-result'));
      expect(types).not.toContain('tool-call-approval');
      expect(types).not.toContain('tool-call');
      expect(types.filter(t => t === 'text-delta')).toHaveLength(1);
      expect(types).toContain('tool-result');
      expect(types.at(-1)).toBe('finish');
    });

    it('a subscriber listening across an approval sees the resumed half start again', async () => {
      const agent = setup({ durable, delayMs, tool: 'lookup' });
      const subscription = await agent.subscribeToThread({ threadId, resourceId });
      const types: string[] = [];
      const consumed = (async () => {
        for await (const chunk of subscription.stream) types.push(chunk.type);
      })();
      const first = await agent.stream('go', { memory: memoryOption });
      await drain(first);
      await vi.waitFor(() => expect(types).toContain('tool-call-approval'));
      await drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));
      await vi.waitFor(() => expect(types.at(-1)).toBe('finish'));
      subscription.unsubscribe();
      await consumed;

      const afterApproval = types.slice(types.indexOf('tool-call-approval') + 1);
      expect(afterApproval[0]).toBe('start');
      expect(afterApproval).toContain('tool-result');
    });

    it('joining during step 2 of a run saved at each step sends only step 2', async () => {
      const answerGate = deferred();
      const stepSaved = deferred();
      const agent = setup({
        durable,
        delayMs,
        tool: 'echo',
        beforeAnswer: answerGate.promise,
        saveEachStep: true,
        onStepSaved: stepSaved.resolve,
      });
      const run = drain(await agent.stream('go', { memory: memoryOption }));
      await stepSaved.promise;

      const chunks = join(
        agent,
        run.then(() => undefined),
      );
      await nextTicks(20);
      answerGate.resolve();
      const received = await chunks;
      const types = received.map(c => c.type);

      expect(types[0]).toBe('thread-history');
      expect(types.filter(t => t === 'start')).toHaveLength(1);
      const stored = historyParts(received[0]);
      expect(stored).toContain('tool-invocation');
      expect(types).not.toContain('tool-call');
      expect(types).not.toContain('tool-result');
      expect(received.filter(c => c.type === 'text-delta').map(c => c.payload.text)).toEqual(['answer']);
    });

    it('joining after one of two approvals is answered still delivers the other', async () => {
      const toolGate = deferred();
      const toolStarted = deferred();
      const agent = setup({
        durable,
        delayMs,
        tool: 'lookup',
        siblings: true,
        toolGate: toolGate.promise,
        onToolStart: toolStarted.resolve,
      });
      const first = await agent.stream('go', { memory: memoryOption });
      await drain(first);

      const resumed = drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));
      await toolStarted.promise;
      const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
      const chunks: any[] = [];
      const consumed = (async () => {
        for await (const chunk of subscription.stream) chunks.push(chunk);
      })();
      toolGate.resolve();
      await resumed;
      await vi.waitFor(() => expect(chunks.some(c => c.type === 'tool-call-approval')).toBe(true));
      await nextTicks(20);
      subscription.unsubscribe();
      await consumed;

      expect(chunks.filter(c => c.type === 'tool-call-approval').map(c => c.payload.toolCallId)).toEqual(['call-2']);
    });

    it('trims the saved step from the topic while the run continues', async () => {
      const answerGate = deferred();
      const stepSaved = deferred();
      const agent = setup({
        durable,
        delayMs,
        tool: 'echo',
        beforeAnswer: answerGate.promise,
        saveEachStep: true,
        onStepSaved: stepSaved.resolve,
      });
      const run = drain(await agent.stream('go', { memory: memoryOption }));
      await stepSaved.promise;
      await vi.waitFor(async () => {
        const parts = await topicParts();
        expect(parts).toContain('start');
        expect(parts).not.toContain('tool-call');
      });

      const midRun = await topicParts();
      expect(midRun).not.toContain('tool-call');
      expect(midRun).not.toContain('text-delta');
      expect(midRun).toContain('start');

      answerGate.resolve();
      await run;
    });

    it('trims a step saved by savePerStep while the run continues', async () => {
      const answerGate = deferred();
      const step2Started = deferred();
      // Step 2 only starts after step 1 finished and savePerStep saved it.
      const beforeAnswer = {
        then: (resolve: () => void) => (step2Started.resolve(), answerGate.promise.then(resolve)),
      };
      const agent = setup({ durable, delayMs, tool: 'echo', beforeAnswer: beforeAnswer as unknown as Promise<void> });
      const published: string[] = [];
      const publish = agent.testPubsub.publish.bind(agent.testPubsub);
      agent.testPubsub.publish = async (topic, event) => {
        await publish(topic, event);
        if (event.data?.type === 'stream-part') published.push(event.data.part.type);
      };
      const run = drain(await agent.stream('go', { memory: memoryOption, savePerStep: true }));

      await step2Started.promise;
      await vi.waitFor(() => expect(published).toContain('step-finish'));
      await vi.waitFor(async () => expect(await topicParts()).not.toContain('tool-call'));
      expect(await topicParts()).not.toContain('text-delta');

      answerGate.resolve();
      await run;
    });
  });
}
