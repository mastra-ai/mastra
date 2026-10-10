import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

/**
 * Agent-level parity between @mastra/memory's `Memory` and `PlatformMemory`, ported from
 * mock-om-agent, cross-thread-resource-scope and om-error-and-persistence. Each scenario runs
 * against both backends with the same scripted observer.
 *
 * Needs a local Platform API started with MEMORY_TEST_MODEL_URL=http://localhost:4555/v1,
 * PLATFORM_MEMORY_LIVE pointing at `{ instanceId, token }`, and an instance whose
 * observation threshold is 50 tokens. PARITY_SCOPE must match the instance scope.
 */
const live = process.env.PLATFORM_MEMORY_LIVE;
const scope = (process.env.PARITY_SCOPE ?? 'thread') as 'thread' | 'resource';
const API = 'http://127.0.0.1:3010';

const BODY = `Date: Jan 1, 2026
* 🔴 User's name is Ada and she lives in Kyoto.`;
const TAIL = `<current-task>Chatting with Ada.</current-task>
<suggested-response>Greet Ada by name.</suggested-response>`;

/** Same output as createMockObserverModel; resource scope asks for one block per thread. */
function observerOutput(prompt: string): string {
  const ids = [...new Set([...prompt.matchAll(/<thread id=\\?"([^"\\]+)/g)].map(m => m[1]))];
  const body = ids.length ? ids.map(id => `<thread id="${id}">\n${BODY}\n</thread>`).join('\n') : BODY;
  return `<observations>\n${body}\n</observations>\n${TAIL}`;
}

function scriptedServer(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      const text = observerOutput(raw);
      const base = { id: 'x', created: 0, model: 'scripted' };
      const usage = { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 };
      if (!JSON.parse(raw).stream) {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            ...base,
            object: 'chat.completion',
            choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
            usage,
          }),
        );
        return;
      }
      res.setHeader('content-type', 'text/event-stream');
      const send = (d: unknown) => res.write(`data: ${JSON.stringify(d)}\n\n`);
      const chunk = { ...base, object: 'chat.completion.chunk' };
      send({ ...chunk, choices: [{ index: 0, delta: { role: 'assistant', content: text } }] });
      send({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage });
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

function streamOf(parts: unknown[]) {
  return { stream: convertArrayToReadableStream(parts as never[]) };
}

const textParts = (text: string, finishReason = 'stop') => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: text },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
];

function localObserver() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => streamOf(textParts(observerOutput(JSON.stringify(prompt)))),
  });
}

const reply =
  'I understand your request completely. Here is a comprehensive and detailed response covering every aspect of what you asked, with thoughts and recommendations based on the information you provided.';

/** Calls the `test` tool once per turn, then answers. Records every prompt it receives. */
function agentModel(prompts: string[]) {
  const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const toolTurn = prompt.at(-1)?.role !== 'tool';
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        finishReason: toolTurn ? 'tool-calls' : 'stop',
        content: toolTurn
          ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'test', input: '{"action":"trigger"}' }]
          : [{ type: 'text', text: reply }],
      } as never;
    },
    doStream: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      if (prompt.at(-1)?.role === 'tool') return streamOf(textParts(reply));
      return streamOf([
        { type: 'stream-start', warnings: [] },
        { type: 'tool-input-start', id: 'call-1', toolName: 'test' },
        { type: 'tool-input-delta', id: 'call-1', delta: '{"action":"trigger"}' },
        { type: 'tool-input-end', id: 'call-1' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', input: '{"action":"trigger"}' },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ]);
    },
  });
}

const testTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({ action: z.string().optional() }),
  execute: async () => ({ success: true, message: 'Tool executed' }),
});

interface StoredMessage {
  id: string;
  role: string;
  createdAt: string | Date;
  text: string;
}

interface Backend {
  memory: MastraMemory;
  /** Lets background observation finish before asserting. */
  settle(threadId: string): Promise<void>;
  observations(threadId: string, resourceId: string): Promise<string | null>;
  messages(threadId: string): Promise<StoredMessage[]>;
  clone(threadId: string, newThreadId: string): Promise<void>;
}

function localBackend(): Backend {
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope,
        observation: { model: localObserver() as never, messageTokens: 50, bufferTokens: false },
        reflection: { model: localObserver() as never, observationTokens: 100_000 },
      },
    },
  });
  const memoryStore = async () => (await store.getStore('memory'))!;
  return {
    memory,
    settle: async () => {},
    observations: async (threadId, resourceId) =>
      (await (await memoryStore()).getObservationalMemory(scope === 'resource' ? null : threadId, resourceId))
        ?.activeObservations ?? null,
    messages: async threadId => {
      const { messages } = await (
        await memoryStore()
      ).listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      return messages.map(m => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        text: JSON.stringify(m.content),
      }));
    },
    clone: async (threadId, newThreadId) => {
      await memory.cloneThread({ sourceThreadId: threadId, newThreadId });
    },
  };
}

function platformBackend(): Backend {
  const { instanceId, token } = JSON.parse(readFileSync(live!, 'utf8'));
  const client = new PlatformMemoryClient({ apiUrl: API, accessToken: token, instanceId });
  return {
    memory: new PlatformMemory({ client }),
    settle: async threadId => {
      await client.observe(threadId);
    },
    observations: async threadId => (await client.getObservations(threadId))?.activeObservations ?? null,
    messages: async threadId => {
      const { messages } = await client.listMessages(threadId, { perPage: 100 });
      return messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt, text: JSON.stringify(m) }));
    },
    clone: async (threadId, newThreadId) => {
      await client.cloneThread(threadId, { newThreadId });
    },
  };
}

function expectOrdered(messages: StoredMessage[]) {
  expect(new Set(messages.map(m => m.id)).size).toBe(messages.length);
  for (let i = 1; i < messages.length; i++) {
    expect(new Date(messages[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(messages[i - 1]!.createdAt).getTime(),
    );
  }
}

let server: Server;
beforeAll(async () => {
  if (live) server = await scriptedServer(4555);
});
afterAll(() => server?.close());

describe.skipIf(!live).each([
  ['Memory', localBackend],
  ['PlatformMemory', platformBackend],
] as const)(`OM agent parity (%s, ${scope} scope)`, (_name, makeBackend) => {
  const run = `${Date.now()}`;
  const setup = () => {
    const backend = makeBackend();
    const prompts: string[] = [];
    const agent = new Agent({
      id: 'parity',
      name: 'parity',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: agentModel(prompts) as never,
      tools: { test: testTool },
      memory: backend.memory,
    });
    return { backend, agent, prompts };
  };
  const ids = (name: string) => ({ thread: `${name}-${run}`, resource: `res-${name}-${run}` });

  it('executes multi-step: tool call on step 0, text on step 1', async () => {
    const { agent } = setup();
    const result = await agent.generate('Help me with this task.', { memory: ids('multi') });
    expect(result.text).toContain('I understand your request');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect((result.steps[0]?.toolCalls?.[0] as any)?.payload?.toolName).toBe('test');
  });

  it('observes after multi-step execution', async () => {
    const { agent, backend } = setup();
    const { thread, resource } = ids('observe');
    await agent.generate('Help me with this task.', { memory: { thread, resource } });
    await backend.settle(thread);
    expect(await backend.observations(thread, resource)).toContain('lives in Kyoto');
  });

  it('works with streaming', async () => {
    const { agent } = setup();
    const response = await agent.stream('Tell me about the weather.', { memory: ids('stream') });
    let text = '';
    for await (const chunk of response.textStream) text += chunk;
    expect(text).toContain('I understand your request');
  });

  it('A — persists all messages in order after multi-step generate', async () => {
    const { agent, backend } = setup();
    const { thread, resource } = ids('order-a');
    await agent.generate('Tell me something useful.', { memory: { thread, resource } });
    const messages = await backend.messages(thread);
    const user = messages.findIndex(m => m.role === 'user');
    expect(user).toBeGreaterThanOrEqual(0);
    expect(messages.findIndex(m => m.role === 'assistant')).toBeGreaterThan(user);
    expect(messages.some(m => m.text.includes('"toolName":"test"'))).toBe(true);
    expectOrdered(messages);
  });

  it('C — second turn loads context and keeps order', async () => {
    const { agent, backend, prompts } = setup();
    const memory = ids('order-c');
    await agent.generate('First message', { memory });
    await backend.settle(memory.thread);
    await agent.generate('Second message', { memory });
    const messages = await backend.messages(memory.thread);
    expect(messages.filter(m => m.role === 'user').length).toBeGreaterThanOrEqual(2);
    expectOrdered(messages);
    const secondTurn = prompts.find(p => p.includes('Second message'))!;
    expect(secondTurn).toContain('lives in Kyoto');
    expect(secondTurn).toContain('<system-reminder>');
  });

  it('clones a thread with its messages and observations', async () => {
    const { agent, backend } = setup();
    const { thread, resource } = ids('clone');
    await agent.generate('Help me with this task.', { memory: { thread, resource } });
    await backend.settle(thread);
    const copy = `${thread}-copy`;
    await backend.clone(thread, copy);
    const [source, cloned] = [await backend.messages(thread), await backend.messages(copy)];
    expect(cloned.length).toBe(source.length);
    expect(cloned.map(m => m.role)).toEqual(source.map(m => m.role));
    expect(await backend.observations(copy, resource)).toContain('lives in Kyoto');
  });

  it.skipIf(scope !== 'resource')('shares resource-scoped observations across threads without re-homing', async () => {
    const { agent, backend, prompts } = setup();
    const resource = `res-cross-${run}`;
    await agent.generate('Hello from thread A, I need help with something important.', {
      memory: { thread: `a-${run}`, resource },
    });
    await backend.settle(`a-${run}`);
    const res = await agent.generate('Hello from thread B, help me too.', {
      memory: { thread: `b-${run}`, resource },
    });
    expect(res.text).toBeTruthy();
    expect(prompts.find(p => p.includes('Hello from thread B'))).toContain('lives in Kyoto');
    const threadB = await backend.messages(`b-${run}`);
    expect(threadB.some(m => m.text.includes('Hello from thread A'))).toBe(false);
  });
});
