/**
 * `subscribeToThread({ withInitialHistory })` while publishing lags behind the
 * model: parts must be judged by when they were produced, so nothing storage
 * already holds is sent again after the `thread-history` chunk.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const threadId = 'lag-thread';
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
function stepSaver(memory: MockMemory, onSaved?: () => void): Processor {
  return {
    id: 'step-saver',
    processInputStep: async ({ messageList, stepNumber }) => {
      if (stepNumber === 0) return;
      if (!(await memory.getThreadById({ threadId }))) {
        await memory.saveThread({
          thread: { id: threadId, resourceId, title: '', createdAt: new Date(), updatedAt: new Date() },
        });
      }
      const messages = [...messageList.get.input.db(), ...messageList.get.response.db()];
      await memory.saveMessages({ messages });
      onSaved?.();
    },
  };
}

function setup(options: {
  delayMs: number;
  tool: 'lookup' | 'echo';
  beforeAnswer?: Promise<void>;
  toolGate?: Promise<void>;
  onToolStart?: () => void;
  saveEachStep?: boolean;
  onStepSaved?: () => void;
  siblings?: boolean;
}) {
  const pubsub = new LeasePubSub();
  pubsub.retain = true;
  pubsub.streamPartDelayMs = options.delayMs;
  const memory = new MockMemory();
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
    inputProcessors: options.saveEachStep ? [stepSaver(memory, options.onStepSaved)] : [],
  });
  const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
  return mastra.getAgent('agent');
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  const types: string[] = [];
  for await (const chunk of stream.fullStream) types.push(chunk.type);
  await nextTicks(20);
  return types;
}

/** Subscribe with history and collect chunk types until `until` settles. */
async function join(agent: Agent<any, any, any, any>, until: Promise<unknown> = nextTicks(20)) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
  const chunks: any[] = [];
  const consumed = (async () => {
    for await (const chunk of subscription.stream) chunks.push(chunk);
  })();
  await until;
  await nextTicks(20);
  subscription.unsubscribe();
  await consumed;
  return chunks;
}

function historyParts(chunk: any): string[] {
  return (chunk.payload?.messages ?? []).flatMap((m: any) => (m.content?.parts ?? []).map((p: any) => p.type));
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe.each([0, 5])('thread history with %i ms publish lag', delayMs => {
  it('reconnecting to a run waiting on approval delivers only the approval', async () => {
    const agent = setup({ delayMs, tool: 'lookup' });
    await drain(await agent.stream('go', { memory: memoryOption }));

    expect((await join(agent)).map(c => c.type)).toEqual(['thread-history', 'tool-call-approval']);
  });

  it('joining while an approved run resumes sends neither step 1 nor the answered approval', async () => {
    const toolGate = deferred();
    const toolStarted = deferred();
    const agent = setup({ delayMs, tool: 'lookup', toolGate: toolGate.promise, onToolStart: toolStarted.resolve });
    const first = await agent.stream('go', { memory: memoryOption });
    await drain(first);

    const resumed = drain(await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' }));
    await toolStarted.promise;
    const chunks = join(
      agent,
      resumed.then(() => undefined),
    );
    await nextTicks(20);
    toolGate.resolve();
    const types = (await chunks).map(c => c.type);

    expect(types[0]).toBe('thread-history');
    expect(types).not.toContain('tool-call-approval');
    expect(types).not.toContain('tool-call');
    expect(types.filter(t => t === 'text-delta')).toHaveLength(1);
    expect(types).toContain('tool-result');
    expect(types.at(-1)).toBe('finish');
  });

  it('joining during step 2 of a run saved at each step sends only step 2', async () => {
    const answerGate = deferred();
    const stepSaved = deferred();
    const agent = setup({
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
});
