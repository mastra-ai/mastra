import { Agent as PiAgent } from '@earendil-works/pi-agent-core';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import type { TranscriptContext } from '@earendil-works/pi-ai';
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { tool as lcTool } from '@langchain/core/tools';
import { createDeepAgent } from 'deepagents';
import { createAgent } from 'langchain';
import { platformMemoryAgentMiddleware } from './langgraph';
import { withPlatformMemory } from './pi-agent';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { generateText, stepCountIs, tool, wrapLanguageModel } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { platformMemoryMiddleware } from './ai-sdk';
import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

/**
 * Agent-level parity between @mastra/memory's `Memory` and `PlatformMemory`, ported from
 * mock-om-agent and om-error-and-persistence. Observational memory is thread-scoped. Each scenario runs
 * against both backends with the same scripted observer.
 *
 * Needs a local Platform API started with MEMORY_TEST_MODEL_URL=http://localhost:4555/v1,
 * PLATFORM_MEMORY_LIVE pointing at `{ instanceId, token }`, and an instance whose
 * observation threshold is 50 tokens.
 */
const live = process.env.PLATFORM_MEMORY_LIVE;
const API = 'http://127.0.0.1:3010';

const BODY = `Date: Jan 1, 2026
* 🔴 User's name is Ada and she lives in Kyoto.`;
const TAIL = `<current-task>Chatting with Ada.</current-task>
<suggested-response>Greet Ada by name.</suggested-response>`;

/** Same output as createMockObserverModel. */
function observerOutput(): string {
  return `<observations>
${BODY}
</observations>
${TAIL}`;
}

function scriptedServer(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      const text = observerOutput();
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
    doStream: async () => streamOf(textParts(observerOutput())),
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
      (await (await memoryStore()).getObservationalMemory(threadId, resourceId))?.activeObservations ?? null,
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
    memory: new PlatformMemory({ client, workingMemory: 'off' }),
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
] as const)('OM agent parity (%s)', (_name, makeBackend) => {
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
});

/** Strips ids and timestamps so prompts from both backends can be compared verbatim. */
function normalize(prompt: string, run: string): string {
  return prompt
    .replaceAll(run, 'RUN')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'ISO')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? [A-Z][a-z]+ \d{1,2},? \d{4}\b/g, 'DATE')
    .replace(/\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/g, 'DATE')
    .replace(/\b\d{1,2}:\d{2}( ?[AP]M)?\b/g, 'TIME');
}

describe.skipIf(!live)('what the agent model sees', () => {
  it('is the same on every turn for Memory and PlatformMemory', async () => {
    const run = `eq${Date.now()}`;
    const turns = [
      'Hi, my name is Ada and I live in Kyoto.',
      'I work as a ceramicist and I love tea ceremonies.',
      'What should I cook tonight?',
      'Remind me what you know about me.',
      'Thanks, talk soon.',
    ];
    const seen: Record<string, string[][]> = {};
    for (const [name, make] of [
      ['Memory', localBackend],
      ['PlatformMemory', platformBackend],
    ] as const) {
      const backend = make();
      const prompts: string[] = [];
      const agent = new Agent({
        id: 'parity',
        name: 'parity',
        instructions: 'You are a helpful assistant. Always use the test tool first.',
        model: agentModel(prompts) as never,
        tools: { test: testTool },
        memory: backend.memory,
      });
      seen[name] = [];
      for (const turn of turns) {
        prompts.length = 0;
        await agent.generate(turn, { memory: { thread: `eq-${run}`, resource: `res-eq-${run}` } });
        await backend.settle(`eq-${run}`);
        seen[name].push(prompts.map(p => normalize(p, run)));
      }
    }
    if (process.env.PARITY_DUMP) writeFileSync(process.env.PARITY_DUMP, JSON.stringify(seen));
    // Memory observes mid-turn and keeps that turn's tail raw; PlatformMemory observes after the
    // turn. That timing gap is the one accepted difference. Everything else (system blocks,
    // observation wording/layout, continuation reminder, the new user turn) must match.
    const systemOf = (p: string) => (JSON.parse(p) as { role: string }[]).filter(m => m.role === 'system');
    const lastUser = (p: string) => (JSON.parse(p) as { role: string }[]).filter(m => m.role === 'user').at(-1);
    for (let i = 1; i < turns.length; i++) {
      const mem = seen.Memory![i]![0]!;
      const plat = seen.PlatformMemory![i]![0]!;
      expect({ turn: i, system: systemOf(plat) }).toEqual({ turn: i, system: systemOf(mem) });
      expect(JSON.stringify(lastUser(plat))).toContain(turns[i]!);
      expect(JSON.stringify(lastUser(mem))).toContain(turns[i]!);
    }
  });
});

/** Calls the tool `calls` times in one turn, then answers. */
function loopModel(prompts: string[], calls: number) {
  const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const step = prompts.length;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        finishReason: step <= calls ? 'tool-calls' : 'stop',
        content:
          step <= calls
            ? [{ type: 'tool-call', toolCallId: `call-${step}`, toolName: 'bulk', input: '{}' }]
            : [{ type: 'text', text: reply }],
      } as never;
    },
  });
}

const bulkTool = createTool({
  id: 'bulk',
  description: 'Returns a large payload',
  inputSchema: z.object({}),
  execute: async () => ({ rows: 'lorem ipsum dolor sit amet '.repeat(40) }),
});

describe.skipIf(!live).each([
  ['Memory', localBackend],
  ['PlatformMemory', platformBackend],
] as const)('long tool loop (%s)', (_name, makeBackend) => {
  it('observes mid-turn so the prompt stays bounded', async () => {
    const backend = makeBackend();
    const prompts: string[] = [];
    const agent = new Agent({
      id: 'loop',
      name: 'loop',
      instructions: 'Use the bulk tool repeatedly.',
      model: loopModel(prompts, 6) as never,
      tools: { bulk: bulkTool },
      memory: backend.memory,
    });
    const run = `${Date.now()}`;
    const result = await agent.generate('Collect all the rows.', {
      memory: { thread: `loop-${run}`, resource: `res-loop-${run}` },
      maxSteps: 10,
    });
    expect(result.text).toContain('I understand your request');
    // Observations land inside the same turn, and the last prompt no longer carries every tool result.
    expect(prompts.at(-1)).toContain('lives in Kyoto');
    expect(prompts.at(-1)!.split('lorem ipsum').length).toBeLessThan(6 * 40);
    const saved = await backend.messages(`loop-${run}`);
    expect(saved.filter(m => m.text.includes('"toolName":"bulk"')).length).toBeGreaterThanOrEqual(6);
  });
});

describe.skipIf(!live)('long tool loop (AI SDK middleware)', () => {
  it('observes mid-turn so the prompt stays bounded', async () => {
    const { instanceId, token } = JSON.parse(readFileSync(live!, 'utf8'));
    const client = new PlatformMemoryClient({ apiUrl: API, accessToken: token, instanceId });
    const threadId = `aisdk-loop-${Date.now()}`;
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const prompts: string[] = [];
    const model = new MockLanguageModelV3({
      doGenerate: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        const step = prompts.length;
        return step <= 6
          ? {
              content: [{ type: 'tool-call', toolCallId: `call-${step}`, toolName: 'bulk', input: '{}' }],
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text', text: reply }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage,
              warnings: [],
            };
      },
    });
    const result = await generateText({
      model: wrapLanguageModel({ model, middleware: platformMemoryMiddleware({ client, threadId }) }),
      prompt: 'Collect all the rows.',
      tools: {
        bulk: tool({
          inputSchema: z.object({}),
          execute: async () => ({ rows: 'lorem ipsum dolor sit amet '.repeat(40) }),
        }),
      },
      stopWhen: stepCountIs(10),
    });
    expect(result.text).toContain('I understand your request');
    expect(prompts.at(-1)).toContain('lives in Kyoto');
    expect(prompts.at(-1)!.split('lorem ipsum').length).toBeLessThan(6 * 40);
    const { messages } = await client.listMessages(threadId, { perPage: 100 });
    const stored = JSON.stringify(messages);
    // Sealed after each mid-turn observation, so steps never repeat across messages.
    const callIds = [...stored.matchAll(/"toolCallId":"([^"]+)"/g)].map(m => m[1]);
    expect(callIds).toHaveLength(6);
    expect(new Set(callIds).size).toBe(6);
    expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
  });
});

async function expectLoopStored(client: PlatformMemoryClient, threadId: string, prompts: string[]) {
  expect(prompts.at(-1)).toContain('lives in Kyoto');
  expect(prompts.at(-1)!.split('lorem ipsum').length).toBeLessThan(6 * 40);
  const { messages } = await client.listMessages(threadId, { perPage: 100 });
  const callIds = [...JSON.stringify(messages).matchAll(/"toolCallId":"([^"]+)"/g)].map(m => m[1]);
  expect(callIds).toHaveLength(6);
  expect(new Set(callIds).size).toBe(6);
  expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
}

const liveClient = () => {
  const { instanceId, token } = JSON.parse(readFileSync(live!, 'utf8'));
  return new PlatformMemoryClient({ apiUrl: API, accessToken: token, instanceId });
};
const rows = 'lorem ipsum dolor sit amet '.repeat(40);

describe.skipIf(!live)('long tool loop (pi agent)', () => {
  it('observes mid-turn so the prompt stays bounded', async () => {
    const client = liveClient();
    const threadId = `pi-loop-${Date.now()}`;
    const faux = createFauxCore({});
    const prompts: string[] = [];
    faux.setResponses(
      Array.from({ length: 7 }, (_, i) => (context: TranscriptContext) => {
        prompts.push(JSON.stringify(context.messages));
        return i < 6
          ? fauxAssistantMessage(fauxToolCall('bulk', {}, { id: `call-${i + 1}` }), { stopReason: 'toolUse' })
          : fauxAssistantMessage(reply);
      }),
    );
    const bulk: AgentTool = {
      name: 'bulk',
      label: 'bulk',
      description: 'Bulk rows',
      parameters: Type.Object({}),
      execute: async () => ({ content: [{ type: 'text', text: rows }], details: {} }),
    };
    const agent = new PiAgent({
      streamFn: faux.streamSimple,
      initialState: { systemPrompt: 'Use the bulk tool repeatedly.', model: faux.getModel(), tools: [bulk] },
    });
    withPlatformMemory(agent, { client, threadId });
    await agent.prompt('Collect all the rows.');
    await expectLoopStored(client, threadId, prompts);
  });
});

describe.skipIf(!live)('long tool loop (LangGraph)', () => {
  it('observes mid-turn so the prompt stays bounded', async () => {
    const client = liveClient();
    const threadId = `lg-loop-${Date.now()}`;
    const prompts: string[] = [];
    class LoopModel extends BaseChatModel {
      _llmType() {
        return 'loop';
      }
      bindTools() {
        return this;
      }
      async _generate(messages: BaseMessage[]): Promise<ChatResult> {
        prompts.push(JSON.stringify(messages.map(m => m.content)));
        const step = prompts.length;
        const message =
          step <= 6
            ? new AIMessage({ content: '', tool_calls: [{ id: `call-${step}`, name: 'bulk', args: {} }] })
            : new AIMessage(reply);
        return { generations: [{ message, text: message.text }] };
      }
    }
    const agent = createAgent({
      model: new LoopModel({}),
      tools: [lcTool(async () => rows, { name: 'bulk', description: 'Bulk rows', schema: z.object({}) })],
      systemPrompt: 'Use the bulk tool repeatedly.',
      middleware: [platformMemoryAgentMiddleware({ client })],
    });
    await agent.invoke(
      { messages: [{ role: 'user', content: 'Collect all the rows.' }] },
      { configurable: { thread_id: threadId } },
    );
    await expectLoopStored(client, threadId, prompts);
  });
});

describe.skipIf(!live)('long tool loop (Deep Agents)', () => {
  it('observes mid-turn so the prompt stays bounded', async () => {
    const client = liveClient();
    const threadId = `da-loop-${Date.now()}`;
    const prompts: string[] = [];
    class LoopModel extends BaseChatModel {
      _llmType() {
        return 'loop';
      }
      bindTools() {
        return this;
      }
      async _generate(messages: BaseMessage[]): Promise<ChatResult> {
        prompts.push(JSON.stringify(messages.map(m => m.content)));
        const step = prompts.length;
        const message =
          step <= 6
            ? new AIMessage({ content: '', tool_calls: [{ id: `call-${step}`, name: 'bulk', args: {} }] })
            : new AIMessage(reply);
        return { generations: [{ message, text: message.text }] };
      }
    }
    const agent = createDeepAgent({
      model: new LoopModel({}),
      tools: [lcTool(async () => rows, { name: 'bulk', description: 'Bulk rows', schema: z.object({}) })],
      systemPrompt: 'Use the bulk tool repeatedly.',
      middleware: [platformMemoryAgentMiddleware({ client })],
    });
    await agent.invoke(
      { messages: [{ role: 'user', content: 'Collect all the rows.' }] },
      { configurable: { thread_id: threadId } },
    );
    await expectLoopStored(client, threadId, prompts);
  });
});
