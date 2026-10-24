/**
 * In-flight turn preservation (#25372)
 *
 * Observation can fire between steps of a single agent turn. Whatever it
 * observes is then removed from the live prompt. The model must still see the
 * turn's own user message and the tool results it has not read yet — otherwise
 * it answers (or loops) without the request it is working on.
 *
 * These tests run a real Agent + Memory + ObservationalMemory turn through the
 * public `agent.stream()` API, with a real OpenAI provider pointed at AIMock for
 * both the actor and the Observer, and assert on the request journal: what the
 * actor model was actually sent on each step.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const USER_REQUEST = 'USER_REQUEST_MARKER: look up the order status for order 4471 and report it back.';
const RESULT_MARKER = 'TOOL_RESULT_MARKER';
const BG_RESULT_MARKER = 'BACKGROUND_RESULT_MARKER';
const BG_PLACEHOLDER = 'Background task started';
const FINAL_ANSWER = 'Order 4471 has shipped.';
const LOST = 'LOST_CONTEXT';

// Large enough that one tool result crosses the observation threshold.
const filler = Array.from({ length: 400 }, (_, i) => `line ${i}: shipment scan event recorded at depot`).join('\n');

const OBSERVATIONS = `<observations>
## January 28, 2026
- 🔴 User asked to look up an order status
</observations>
<current-task>Look up the order status</current-task>`;

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

type ChatMessage = { role: string; content?: unknown; tool_call_id?: string };

const lastMessage = (req: { messages: ChatMessage[] }) => req.messages.at(-1);
const lastToolResultFor = (req: { messages: ChatMessage[] }, toolCallId: string) => {
  const last = lastMessage(req);
  return last?.role === 'tool' && last.tool_call_id === toolCallId;
};

/**
 * Observer always returns the same observation. Actor: calls `lookup` `toolSteps` times, each
 * step keyed on the previous step's tool result being the last message, then answers. If the
 * actor is sent a prompt that matches none of those shapes, it answers `LOST_CONTEXT`.
 */
function scriptLookupTurn(toolSteps: number) {
  mock.on({ endpoint: 'chat', model: OBSERVER }, { content: OBSERVATIONS });
  mock.on(
    {
      endpoint: 'chat',
      model: ACTOR,
      predicate: req => lastMessage(req)?.role === 'user' && JSON.stringify(lastMessage(req)).includes('USER_REQUEST'),
    },
    { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: JSON.stringify({ orderId: '4471-0' }) }] },
  );
  for (let n = 1; n <= toolSteps; n++) {
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastToolResultFor(req, `call_${n - 1}`) },
      n < toolSteps
        ? { toolCalls: [{ id: `call_${n}`, name: 'lookup', arguments: JSON.stringify({ orderId: `4471-${n}` }) }] }
        : { content: FINAL_ANSWER },
    );
  }
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: LOST });
}

/** Bodies of the requests the actor model received, in order. */
function actorRequests(): string[] {
  return mock
    .getRequests()
    .filter(entry => (entry.body as { model?: string })?.model === ACTOR)
    .map(entry => JSON.stringify((entry.body as { messages: unknown }).messages));
}

function observerRequestCount(): number {
  return mock.getRequests().filter(entry => (entry.body as { model?: string })?.model === OBSERVER).length;
}

function createMemory(storage = new InMemoryStore(), observerFetch?: typeof fetch) {
  const baseURL = `${mock.url.replace(/\/+$/, '')}/v1`;
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL });
  const observer = observerFetch ? createOpenAI({ apiKey: 'aimock-test-key', baseURL, fetch: observerFetch }) : openai;
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: observer.chat(OBSERVER), messageTokens: 1000, bufferTokens: false },
        reflection: { model: observer.chat(OBSERVER), observationTokens: 100_000 },
      },
    },
  });
  return { memory, openai };
}

const lookup = createTool({
  id: 'lookup',
  description: 'Look up an order',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => ({ orderId, status: `${RESULT_MARKER}-${orderId}`, log: filler }),
});

describe('OM preserves the in-flight turn across mid-turn observation (#25372)', () => {
  // COR-1472: the early save must not drain the live input bucket before OM captures
  // the turn's input IDs, or observation removes the request from later actor prompts.
  for (const engine of ['durable', 'evented'] as const) {
    it.each(['stream', 'generate'] as const)(
      `${engine} %s: persists input before execution without losing it during observation`,
      async method => {
        scriptLookupTurn(1);
        const storage = new InMemoryStore();
        const { memory, openai } = createMemory(storage);
        const threadId = `durable-inflight-${engine}-${method}`;
        const memoryStore = (await storage.getStore('memory'))!;
        let inputIdAtToolEntry: string | undefined;
        const agent = new Agent({
          id: 'durable-inflight-agent',
          name: 'durable-inflight-agent',
          instructions: 'Use the lookup tool.',
          model: openai.chat(ACTOR),
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'Look up an order',
              inputSchema: z.object({ orderId: z.string() }),
              execute: async ({ orderId }) => {
                const { messages } = await memoryStore.listMessages({ threadId, perPage: false });
                expect(messages).toHaveLength(1);
                expect(messages[0]).toMatchObject({ role: 'user', threadId, resourceId: 'r' });
                expect(JSON.stringify(messages[0]!.content)).toContain(USER_REQUEST);
                inputIdAtToolEntry = messages[0]!.id;
                return { orderId, status: `${RESULT_MARKER}-${orderId}`, log: filler };
              },
            }),
          },
          memory,
        });
        const durableAgent =
          engine === 'evented'
            ? createEventedAgent({ agent, pubsub: new EventEmitterPubSub() })
            : createDurableAgent({ agent });
        const mastra = new Mastra({ agents: { agent: durableAgent }, storage, logger: false });
        try {
          expect(durableAgent.resolveWorkflowEngine()).toBe(engine === 'evented' ? 'evented' : 'default');
          const options = { memory: { thread: threadId, resource: 'r' }, maxSteps: 3 };
          let text = '';
          if (method === 'generate') {
            text = (await durableAgent.generate(USER_REQUEST, options)).text;
          } else {
            const stream = await durableAgent.stream(USER_REQUEST, options);
            for await (const chunk of stream.fullStream) {
              if (chunk.type === 'text-delta') text += chunk.payload.text;
            }
          }
          expect(text).toBe(FINAL_ANSWER);
          expect(inputIdAtToolEntry).toBeDefined();
          expect(observerRequestCount()).toBeGreaterThan(0);
          const requests = actorRequests();
          expect(requests).toHaveLength(2);
          expect(requests[1]).toContain('User asked to look up an order status');
          expect(requests[1], 'observation must retain the accepted in-flight request').toContain(USER_REQUEST);
          expect(requests[1]).toContain(`${RESULT_MARKER}-4471-0`);
          const { messages } = await memoryStore.listMessages({ threadId, perPage: false });
          const users = messages.filter(message => message.role === 'user');
          expect(users).toHaveLength(1);
          expect(users[0]!.id).toBe(inputIdAtToolEntry);
          expect(JSON.stringify(messages.filter(message => message.role === 'assistant'))).toContain(FINAL_ANSWER);
        } finally {
          await mastra.stopWorkers();
        }
      },
    );
  }

  it('keeps the user message and the unread tool result in the next step request', async () => {
    scriptLookupTurn(1);
    const { memory, openai } = createMemory();
    const agent = new Agent({
      id: 'inflight-agent',
      name: 'inflight-agent',
      instructions: 'Use the lookup tool.',
      model: openai.chat(ACTOR),
      tools: { lookup },
      memory,
    });

    const stream = await agent.stream(USER_REQUEST, { memory: { thread: 'inflight-1', resource: 'r' } });

    expect(await stream.text).toBe(FINAL_ANSWER);
    const requests = actorRequests();
    expect(requests).toHaveLength(2);
    // The tool result crossed the threshold, so the Observer ran before step 1 …
    expect(requests[1]).toContain('User asked to look up an order status');
    // … and the model, about to answer from that result, still has the request and the result.
    expect(requests[1]).toContain('USER_REQUEST_MARKER');
    expect(requests[1]).toContain(`${RESULT_MARKER}-4471-0`);
  });

  it('keeps the newest tool result on every later step and retires what the model already read', async () => {
    scriptLookupTurn(3);
    const { memory, openai } = createMemory();
    const agent = new Agent({
      id: 'inflight-agent',
      name: 'inflight-agent',
      instructions: 'Use the lookup tool.',
      model: openai.chat(ACTOR),
      tools: { lookup },
      memory,
    });

    const stream = await agent.stream(USER_REQUEST, { memory: { thread: 'inflight-3', resource: 'r' } });

    expect(await stream.text).toBe(FINAL_ANSWER);
    const requests = actorRequests();
    expect(requests).toHaveLength(4);
    for (let step = 1; step < requests.length; step++) {
      expect(requests[step], `step ${step} lost the unread tool result`).toContain(`${RESULT_MARKER}-4471-${step - 1}`);
    }
    // Mid-turn compaction still works: results the model already read are gone once observed,
    // and so is the request it has acted on; the observations carry it.
    expect(requests[3]).toContain('User asked to look up an order status');
    expect(requests[3]).not.toContain('USER_REQUEST_MARKER');
    expect(requests[3]).not.toContain(`${RESULT_MARKER}-4471-0`);
    expect(requests[3]).not.toContain(`${RESULT_MARKER}-4471-1`);
  });

  it('does not put the request back in the prompt once it is observed and the model has acted on it', async () => {
    // The user says "delete it"; the agent acts on it and keeps working through ten more tool
    // steps while memory observes. The observations already record the request. Sending the
    // raw message again ten steps later would read as a new instruction to delete something.
    const deleteRequest = 'USER_REQUEST_MARKER: delete it.';
    scriptLookupTurn(11);
    const { memory, openai } = createMemory();
    const agent = new Agent({
      id: 'observed-request-agent',
      name: 'observed-request-agent',
      instructions: 'Use the lookup tool.',
      model: openai.chat(ACTOR),
      tools: { lookup },
      memory,
    });

    const stream = await agent.stream(deleteRequest, {
      memory: { thread: 'observed-request', resource: 'r' },
      maxSteps: 15,
    });

    expect(await stream.text).toBe(FINAL_ANSWER);
    expect(observerRequestCount()).toBeGreaterThan(0);
    const requests = actorRequests();
    expect(requests).toHaveLength(12);
    const last = requests.at(-1)!;
    // The request is carried by the observations alone …
    expect(last).toContain('User asked to look up an order status');
    expect(last, 'the observed request came back as a fresh message').not.toContain('delete it');
    // … while the tool result the model has not read yet is still sent.
    expect(last).toContain(`${RESULT_MARKER}-4471-10`);
  });

  it('keeps a background task result merged over its placeholder until the model reads it', async () => {
    // Step 0 dispatches `research` in the background: its tool part is written as `result`
    // holding a placeholder. Step 1 calls `lookup`, which lets the task finish and waits until
    // the real result has been merged over the placeholder in place (same message, same part,
    // state still `result`). Step 2 observes (the lookup result crosses the threshold); the
    // actor must still be sent the real background result it has never read.
    let releaseResearch!: () => void;
    const researchGate = new Promise<void>(resolve => (releaseResearch = resolve));
    let markMerged!: () => void;
    const merged = new Promise<void>(resolve => (markMerged = resolve));

    const research = createTool({
      id: 'research',
      description: 'Long-running research',
      inputSchema: z.object({ topic: z.string() }),
      background: { enabled: true, timeoutMs: 10_000 },
      execute: async () => {
        await researchGate;
        return { finding: `${BG_RESULT_MARKER}: carrier confirmed delivery window` };
      },
    });
    const gatedLookup = createTool({
      id: 'lookup',
      description: 'Look up an order',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        releaseResearch();
        await merged;
        return { orderId, status: `${RESULT_MARKER}-${orderId}`, log: filler };
      },
    });

    mock.on({ endpoint: 'chat', model: OBSERVER }, { content: OBSERVATIONS });
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastMessage(req)?.role === 'user' },
      {
        content: filler,
        toolCalls: [{ id: 'call_bg', name: 'research', arguments: JSON.stringify({ topic: '4471' }) }],
      },
    );
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastToolResultFor(req, 'call_bg') },
      { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: JSON.stringify({ orderId: '4471-0' }) }] },
    );
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastToolResultFor(req, 'call_0') },
      { content: FINAL_ANSWER },
    );
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: LOST });

    const storage = new InMemoryStore();
    // Observe the storage boundary: the background result is flushed to memory right after it
    // is merged into the run's message list.
    const memoryStore = (await storage.getStore('memory'))!;
    const saveMessages = memoryStore.saveMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async args => {
      const saved = await saveMessages(args);
      if (JSON.stringify(args.messages).includes(BG_RESULT_MARKER)) markMerged();
      return saved;
    });

    const { memory, openai } = createMemory(storage);
    const agent = new Agent({
      id: 'inflight-bg-agent',
      name: 'inflight-bg-agent',
      instructions: 'Research, then look up the order.',
      model: openai.chat(ACTOR),
      tools: { research, lookup: gatedLookup },
      backgroundTasks: { tools: { research: true } },
      memory,
    });
    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
    });
    await mastra.startWorkers();

    try {
      const stream = await mastra
        .getAgent('agent')
        .stream(USER_REQUEST, { memory: { thread: 'inflight-bg', resource: 'r' } });
      expect(await stream.text).toBe(FINAL_ANSWER);
    } finally {
      await mastra.stopWorkers();
    }

    const requests = actorRequests();
    expect(requests).toHaveLength(3);
    expect(requests[1]).toContain(BG_PLACEHOLDER);
    expect(requests[1]).not.toContain(BG_RESULT_MARKER);
    // Step 2 ran after an observation …
    expect(observerRequestCount()).toBeGreaterThan(0);
    expect(requests[2]).toContain('User asked to look up an order status');
    // … and still carries the background result the model has not read yet.
    expect(requests[2], 'the background task result was removed before the model read it').toContain(BG_RESULT_MARKER);
  });

  it('keeps a background task result merged while the Observer is running', async () => {
    // Step 0 dispatches `research` in the background (placeholder result) and step 1 calls
    // `lookup`. The task is released only once step 2's observation reaches the Observer, and
    // the Observer reply is held until the real result has been merged over the placeholder. So
    // the merge lands after step 2 scanned for unread output but before cleanup runs.
    let releaseResearch!: () => void;
    const researchGate = new Promise<void>(resolve => (releaseResearch = resolve));
    let markMerged!: () => void;
    const merged = new Promise<void>(resolve => (markMerged = resolve));

    const research = createTool({
      id: 'research',
      description: 'Long-running research',
      inputSchema: z.object({ topic: z.string() }),
      background: { enabled: true, timeoutMs: 10_000 },
      execute: async () => {
        await researchGate;
        return { finding: `${BG_RESULT_MARKER}: carrier confirmed delivery window` };
      },
    });

    mock.on({ endpoint: 'chat', model: OBSERVER }, { content: OBSERVATIONS });
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastMessage(req)?.role === 'user' },
      {
        content: filler,
        toolCalls: [{ id: 'call_bg', name: 'research', arguments: JSON.stringify({ topic: '4471' }) }],
      },
    );
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastToolResultFor(req, 'call_bg') },
      { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: JSON.stringify({ orderId: '4471-0' }) }] },
    );
    mock.on(
      { endpoint: 'chat', model: ACTOR, predicate: req => lastToolResultFor(req, 'call_0') },
      { content: FINAL_ANSWER },
    );
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: LOST });

    const storage = new InMemoryStore();
    const memoryStore = (await storage.getStore('memory'))!;
    const saveMessages = memoryStore.saveMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async args => {
      const saved = await saveMessages(args);
      if (JSON.stringify(args.messages).includes(BG_RESULT_MARKER)) markMerged();
      return saved;
    });

    let observerCalls = 0;
    const observerFetch: typeof fetch = async (input, init) => {
      // Step 1 observes the step-0 output; step 2 observes the lookup result.
      if (++observerCalls === 2) {
        releaseResearch();
        await merged;
      }
      return fetch(input, init);
    };

    const { memory, openai } = createMemory(storage, observerFetch);
    const agent = new Agent({
      id: 'inflight-bg-race-agent',
      name: 'inflight-bg-race-agent',
      instructions: 'Research, then look up the order.',
      model: openai.chat(ACTOR),
      tools: { research, lookup },
      backgroundTasks: { tools: { research: true } },
      memory,
    });
    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
    });
    await mastra.startWorkers();

    try {
      const stream = await mastra
        .getAgent('agent')
        .stream(USER_REQUEST, { memory: { thread: 'inflight-bg-race', resource: 'r' } });
      expect(await stream.text).toBe(FINAL_ANSWER);
    } finally {
      await mastra.stopWorkers();
    }

    const requests = actorRequests();
    expect(requests).toHaveLength(3);
    expect(observerCalls).toBe(2);
    expect(requests[1]).not.toContain(BG_RESULT_MARKER);
    expect(requests[2], 'the background task result merged during observation was removed').toContain(BG_RESULT_MARKER);
  });
});
