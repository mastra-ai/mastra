import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { AsyncCallbackPubSub } from './signals-test-utils';
import { AGENT_THREAD_KEY_SEPARATOR } from './thread-stream-test-utils';

// Counts live thread-save listeners per thread. The registry is module-private,
// so the subscribe function is wrapped instead.
const listeners = vi.hoisted(() => ({ active: new Map<string, number>(), peak: new Map<string, number>() }));
vi.mock('../thread-saves', async importOriginal => {
  const original = await importOriginal<typeof import('../thread-saves')>();
  return {
    ...original,
    onThreadMessagesSaved: (...args: Parameters<typeof original.onThreadMessagesSaved>) => {
      const threadId = args[0].threadId;
      const stop = original.onThreadMessagesSaved(...args);
      const active = (listeners.active.get(threadId) ?? 0) + 1;
      listeners.active.set(threadId, active);
      listeners.peak.set(threadId, Math.max(listeners.peak.get(threadId) ?? 0, active));
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        listeners.active.set(threadId, listeners.active.get(threadId)! - 1);
        stop();
      };
    },
  };
});

const activeListeners = (threadId: string) => listeners.active.get(threadId) ?? 0;

describe('thread-save listeners of durable runs (#29010)', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  beforeEach(() => {
    llm.clearFixtures();
    listeners.active.clear();
    listeners.peak.clear();
  });

  it('holds no listener while runs wait for approval and reattaches one for the resumed run', async () => {
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const base = new Agent({
      id: 'save-listener',
      name: 'save-listener',
      instructions: 'Look it up.',
      model: openai('gpt-4o-mini'),
      memory: new MockMemory(),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Looks something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    const durable = createDurableAgent({ agent: base });
    const mastra = new Mastra({ agents: { agent: durable as any }, storage, pubsub, logger: false });
    const agent = mastra.getAgent('agent') as any;

    const parked: Array<{ memory: { thread: string; resource: string }; runId: string; toolCallId: string }> = [];
    for (let index = 0; index < 3; index++) {
      const prompt = `look up item ${index}`;
      llm.on(
        { userMessage: prompt, sequenceIndex: 0 },
        { toolCalls: [{ id: `call_${index}`, name: 'lookup', arguments: {} }] },
      );
      llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: `found item ${index}` });

      const memory = { thread: `save-listener-thread-${index}`, resource: 'save-listener-user' };
      const suspended = new Promise<void>(resolve => {
        const key = [memory.resource, memory.thread].join(AGENT_THREAD_KEY_SEPARATOR);
        void pubsub.subscribe(`agent.thread-stream.${encodeURIComponent(key)}`, event => {
          if ((event as any)?.data?.type === 'run-suspended') resolve();
        });
      });
      const result = await agent.stream(prompt, { memory });
      let toolCallId: string | undefined;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
          // The durable stream stays open while the run waits for approval.
          break;
        }
      }
      expect(toolCallId).toBeTruthy();
      await suspended;
      parked.push({ memory, runId: result.runId, toolCallId: toolCallId! });
    }

    await vi.waitFor(() => expect(parked.map(run => activeListeners(run.memory.thread))).toEqual([0, 0, 0]));

    const [first] = parked;
    const peakWhileParked = listeners.peak.get(first!.memory.thread)!;
    listeners.peak.set(first!.memory.thread, 0);
    const resumed = await agent.approveToolCall({
      runId: first!.runId,
      toolCallId: first!.toolCallId,
      memory: first!.memory,
    });
    let text = '';
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }

    expect(peakWhileParked).toBe(1);
    expect(text).toBe('found item 0');
    // The resumed half of the run listened for saves again, then let go when it finished.
    expect(listeners.peak.get(first!.memory.thread)).toBe(1);
    await vi.waitFor(() => expect(activeListeners(first!.memory.thread)).toBe(0));
    expect(parked.map(run => activeListeners(run.memory.thread))).toEqual([0, 0, 0]);
  });

  // Driven through the runtime with a hand-built output: durable error recovery keeps
  // `fullStream` open and producing after an error chunk, which a model mock can't script.
  it('does not reattach a listener for parts produced after the run broadcast an error', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new AsyncCallbackPubSub();
    const threadId = 'save-listener-error-thread';
    let source!: ReadableStreamDefaultController<unknown>;
    const output = {
      runId: 'errored-run',
      status: 'running',
      fullStream: new ReadableStream({
        start(controller) {
          source = controller;
        },
      }),
      _waitUntilFinished: () => new Promise<void>(() => {}),
    };
    await runtime.registerRun(
      { id: 'error-agent' } as any,
      output as any,
      { memory: { thread: threadId, resource: 'user' } } as any,
      pubsub,
    );

    source.enqueue({ type: 'start', runId: output.runId, payload: {} });
    source.enqueue({ type: 'error', runId: output.runId, payload: { error: new Error('boom') } });
    source.enqueue({ type: 'text-delta', runId: output.runId, payload: { id: 't', text: 'recovered' } });
    await vi.waitFor(() => expect(listeners.peak.get(threadId)).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(activeListeners(threadId)).toBe(0);
  });
});
