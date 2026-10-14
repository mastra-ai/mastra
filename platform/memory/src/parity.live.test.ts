import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

/**
 * Agent-level parity between @mastra/memory's `Memory` and `PlatformMemory` against a locally
 * running Platform memory server. Every scenario runs on both backends with the same scripted
 * agent model and the same scripted observer, and asserts only what a user can see: the prompts
 * the agent model receives, the stored messages, and the loaded context.
 *
 * Start the server from the platform repo (it provisions an instance, writes PLATFORM_MEMORY_LIVE,
 * points the observer at this file's scripted model and lowers the threshold to 50 tokens):
 *
 *   pnpm --filter @platform/memory-server parity:serve
 *
 * Then: PLATFORM_MEMORY_LIVE=1 pnpm vitest run src/parity.live.test.ts
 * (or set it to the env file path if PARITY_ENV_FILE was overridden).
 */
const liveFlag = process.env.PLATFORM_MEMORY_LIVE;
const live = !!liveFlag;
const envFile = liveFlag && liveFlag !== '1' ? liveFlag : path.join(tmpdir(), 'platform-memory-parity.json');
const MODEL_PORT = Number(process.env.PARITY_MODEL_PORT ?? 4555);

/** Matches the harness: observe after 50 unobserved tokens, never reflect, no async buffering. */
const THRESHOLDS = { messageTokens: 50, observationTokens: 100_000 } as const;
// Set PARITY_BUFFER_TOKENS (and start the harness with the same value) to run with async buffering on.
const BUFFER_TOKENS: number | false = process.env.PARITY_BUFFER_TOKENS ? Number(process.env.PARITY_BUFFER_TOKENS) : false;

const BODY = `Date: Jan 1, 2026
* 🔴 User's name is Ada and she lives in Kyoto.`;
const TAIL = `<current-task>Chatting with Ada.</current-task>
<suggested-response>Greet Ada by name.</suggested-response>`;
/** Every prompt the observer received, from the server (HTTP) and the local backends. */
const observerSeen: string[] = [];
const observerOutput = () => `<observations>\n${BODY}\n</observations>\n${TAIL}`;

/** OpenAI-compatible observer the Platform server calls through its Gateway URL. */
function scriptedObserver(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      observerSeen.push(raw);
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

const streamOf = (parts: unknown[]) => ({ stream: convertArrayToReadableStream(parts as never[]) });

const textParts = (text: string) => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: text },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
];

/** Same observer for the local backend, in-process. */
const localObserver = () =>
  new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      observerSeen.push(JSON.stringify(prompt));
      return streamOf(textParts(observerOutput()));
    },
  });

const reply =
  'I understand your request completely. Here is a comprehensive and detailed response covering every aspect of what you asked, with thoughts and recommendations based on the information you provided.';
const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };

/** Calls the `test` tool once per turn, then answers. Records every prompt it receives. */
function agentModel(prompts: string[]) {
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

/** Calls the `bulk` tool `calls` times in one turn, then answers. */
function loopModel(prompts: string[], calls: number) {
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

const testTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({ action: z.string().optional() }),
  execute: async () => ({ success: true, message: 'Tool executed' }),
});

let bulkBatch = 0;
const bulkTool = createTool({
  id: 'bulk',
  description: 'Returns a large payload',
  inputSchema: z.object({}),
  execute: async () => ({ batch: `batch${++bulkBatch}x`, rows: 'lorem ipsum dolor sit amet '.repeat(40) }),
});

interface StoredMessage {
  id: string;
  role: string;
  createdAt: string | Date;
  text: string;
}

interface Backend {
  memory: MastraMemory;
  /** The observations block the next turn would load, or null before the first observation. */
  observations(threadId: string, resourceId: string): Promise<string | null>;
  messages(threadId: string): Promise<StoredMessage[]>;
}

/**
 * With buffering on, OM's background work races the next step, so even `Memory` disagrees with
 * itself run to run. Settle it after every processor call, as the harness server does
 * (MEMORY_OM_TEST_SETTLE), so any remaining prompt difference is a real one.
 */
function settling<M extends Memory>(memory: M): M {
  if (BUFFER_TOKENS === false) return memory;
  const settle = async () => (await memory.omEngine)?.settled();
  const wrap = (p: any) => ({
    ...p,
    id: p.id,
    name: p.name,
    ...(p.processInputStep && {
      processInputStep: async (a: any) => {
        const out = await p.processInputStep.call(p, a);
        await settle();
        return out;
      },
    }),
    ...(p.processOutputResult && {
      processOutputResult: async (a: any) => {
        const out = await p.processOutputResult.call(p, a);
        await settle();
        return out;
      },
    }),
  });
  const input = memory.getInputProcessors.bind(memory);
  const output = memory.getOutputProcessors.bind(memory);
  memory.getInputProcessors = (async (...a: any[]) => (await (input as any)(...a)).map(wrap)) as never;
  memory.getOutputProcessors = (async (...a: any[]) => (await (output as any)(...a)).map(wrap)) as never;
  return memory;
}

function localBackend(): Backend {
  const store = new InMemoryStore();
  const memory = settling(new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: localObserver() as never, messageTokens: THRESHOLDS.messageTokens, bufferTokens: BUFFER_TOKENS },
        reflection: { model: localObserver() as never, observationTokens: THRESHOLDS.observationTokens },
      },
    },
  }));
  return {
    memory,
    observations: async (threadId, resourceId) =>
      (await memory.getContext({ threadId, resourceId })).systemMessage ?? null,
    messages: async threadId => {
      const memoryStore = (await store.getStore('memory'))!;
      const { messages } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      return messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt, text: JSON.stringify(m.content) }));
    },
  };
}

type OMProcessor = {
  processInputStep(args: any): Promise<unknown>;
};

/**
 * What the memory server will do for each step: a fresh OM processor with no carried state,
 * run against a MessageList rebuilt from its serialized form. If this matches `Memory` on every
 * prompt, the server can run the real processor statelessly behind HTTP.
 */
class StatelessStepMemory extends Memory {
  private async freshOM(requestContext: unknown): Promise<OMProcessor> {
    const processors = await super.getInputProcessors([], requestContext as never);
    return processors.find(p => p.id === 'observational-memory') as unknown as OMProcessor;
  }

  override async getInputProcessors(...args: Parameters<Memory['getInputProcessors']>) {
    const processors = await super.getInputProcessors(...args);
    return processors.map(p => {
      if (p.id !== 'observational-memory') return p;
      return {
        id: p.id,
        name: p.name,
        processInputStep: async (stepArgs: any) => {
          const list = new MessageList().deserialize(structuredClone(stepArgs.messageList.serialize()));
          await (await this.freshOM(stepArgs.requestContext)).processInputStep({
            ...stepArgs,
            messageList: list,
            state: {},
          });
          return stepArgs.messageList.deserialize(structuredClone(list.serialize()));
        },
      } as typeof p;
    });
  }

  override async getOutputProcessors(...args: Parameters<Memory['getOutputProcessors']>) {
    const processors = await super.getOutputProcessors(...args);
    return processors.map(p => {
      if (p.id !== 'observational-memory') return p;
      return {
        id: p.id,
        name: p.name,
        processOutputResult: async ({ messageList }: { messageList: MessageList }) => {
          const { threadId, resourceId } = messageList.serialize().memoryInfo ?? {};
          const om = (await this.omEngine)!;
          const list = new MessageList().deserialize(structuredClone(messageList.serialize()));
          const turn = om.beginTurn({ threadId: threadId!, resourceId, messageList: list });
          await turn.start();
          await turn.end(list);
          return messageList;
        },
      } as unknown as typeof p;
    });
  }
}

function statelessBackend(): Backend {
  const store = new InMemoryStore();
  const memory = settling(new StatelessStepMemory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: localObserver() as never, messageTokens: THRESHOLDS.messageTokens, bufferTokens: BUFFER_TOKENS },
        reflection: { model: localObserver() as never, observationTokens: THRESHOLDS.observationTokens },
      },
    },
  }));
  return {
    memory,
    observations: async (threadId, resourceId) =>
      (await memory.getContext({ threadId, resourceId })).systemMessage ?? null,
    messages: async threadId => {
      const memoryStore = (await store.getStore('memory'))!;
      const { messages } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      return messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt, text: JSON.stringify(m.content) }));
    },
  };
}

function platformBackend(): Backend {
  const { apiUrl, instanceId, token } = JSON.parse(readFileSync(envFile, 'utf8'));
  const client = new PlatformMemoryClient({ apiUrl, accessToken: token, instanceId });
  return {
    memory: new PlatformMemory({ client, workingMemory: 'off' }),
    observations: async (threadId, resourceId) => (await client.getContext(threadId, resourceId)).system,
    messages: async threadId => {
      const { messages } = await client.listMessages(threadId, { perPage: 100 });
      return messages.map(m => ({ id: m.id, role: m.role, createdAt: m.createdAt, text: JSON.stringify(m) }));
    },
  };
}

const BACKENDS = [
  ['Memory', localBackend],
  ['StatelessSteps', statelessBackend],
  ['PlatformMemory', platformBackend],
] as const;

function expectOrdered(messages: StoredMessage[]) {
  expect(new Set(messages.map(m => m.id)).size).toBe(messages.length);
  for (let i = 1; i < messages.length; i++) {
    expect(new Date(messages[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(messages[i - 1]!.createdAt).getTime(),
    );
  }
}

/** Strips ids and timestamps so prompts from both backends can be compared verbatim. */
// Token-count cache @mastra/memory stamps under providerOptions.mastra on messages and parts it
// has counted (`tokenEstimate`, `tool-call-args-json:<hash>`, ...). Providers never see it.
function stripTokenCache(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTokenCache);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'tokenEstimate' || /^tool-(call-args|result)-json:/.test(key)) continue;
    const stripped = stripTokenCache(child);
    if (stripped && typeof stripped === 'object' && !Array.isArray(stripped) && !Object.keys(stripped).length) {
      if (key === 'mastra' || key === 'providerOptions') continue;
    }
    out[key] = stripped;
  }
  return out;
}

function normalize(prompt: string, run: string): string {
  return JSON.stringify(stripTokenCache(JSON.parse(prompt)))
    .replaceAll(run, 'RUN')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'ISO')
    // Epoch-ms stamps Mastra puts in providerOptions; they differ between any two runs.
    .replace(/"createdAt":\d{13}/g, '"createdAt":"EPOCH"')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? [A-Z][a-z]+ \d{1,2},? \d{4}\b/g, 'DATE')
    .replace(/\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/g, 'DATE')
    .replace(/\b\d{1,2}:\d{2}( ?[AP]M)?\b/g, 'TIME');
}

let observer: Server;
beforeAll(async () => {
  if (live) observer = await scriptedObserver(MODEL_PORT);
});
afterAll(() => observer?.close());

describe.skipIf(!live).each(BACKENDS)('OM agent (%s)', (_name, makeBackend) => {
  const run = `${Date.now()}`;
  const ids = (name: string) => ({ thread: `${name}-${run}`, resource: `res-${name}-${run}` });
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

  it('runs a multi-step turn: tool call on step 0, text on step 1', async () => {
    const { agent } = setup();
    const result = await agent.generate('Help me with this task.', { memory: ids('multi') });
    expect(result.text).toContain('I understand your request');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect((result.steps[0]?.toolCalls?.[0] as any)?.payload?.toolName).toBe('test');
  });

  it('streams', async () => {
    const { agent } = setup();
    const response = await agent.stream('Tell me about the weather.', { memory: ids('stream') });
    let text = '';
    for await (const chunk of response.textStream) text += chunk;
    expect(text).toContain('I understand your request');
  });

  it('observes once the turn crosses the threshold', async () => {
    const { agent, backend } = setup();
    const { thread, resource } = ids('observe');
    await agent.generate('Help me with this task.', { memory: { thread, resource } });
    expect(await backend.observations(thread, resource)).toContain('lives in Kyoto');
  });

  it('persists every message of a multi-step turn, in order', async () => {
    const { agent, backend } = setup();
    const { thread, resource } = ids('order');
    await agent.generate('Tell me something useful.', { memory: { thread, resource } });
    const messages = await backend.messages(thread);
    const user = messages.findIndex(m => m.role === 'user');
    expect(user).toBeGreaterThanOrEqual(0);
    expect(messages.findIndex(m => m.role === 'assistant')).toBeGreaterThan(user);
    expect(messages.some(m => m.text.includes('"toolName":"test"'))).toBe(true);
    expectOrdered(messages);
  });

  it('loads observations and the continuation reminder on the next turn', async () => {
    const { agent, backend, prompts } = setup();
    const memory = ids('next');
    await agent.generate('First message', { memory });
    await agent.generate('Second message', { memory });
    const messages = await backend.messages(memory.thread);
    expect(messages.filter(m => m.role === 'user')).toHaveLength(2);
    expectOrdered(messages);
    const secondTurn = prompts.find(p => p.includes('Second message'))!;
    expect(secondTurn).toContain('lives in Kyoto');
    expect(secondTurn).toContain('<system-reminder>');
  });

  it('observes mid-turn in a long tool loop so the prompt stays bounded', async () => {
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
    const { thread, resource } = ids('loop');
    const result = await agent.generate('Collect all the rows.', { memory: { thread, resource }, maxSteps: 10 });
    expect(result.text).toContain('I understand your request');
    expect(prompts.at(-1)).toContain('lives in Kyoto');
    expect(prompts.at(-1)!.split('lorem ipsum').length).toBeLessThan(6 * 40);
    const stored = JSON.stringify(await backend.messages(thread));
    const callIds = [...stored.matchAll(/toolCallId\\*":\\*"([^"\\]+)/g)].map(m => m[1]);
    expect(new Set(callIds).size).toBe(6);
  });
  it('never drops a message from the prompt that the observer has not seen', async () => {
    // Freeze the clock so MessageList spaces every message exactly 1ms apart, as it does when
    // messages arrive within the same millisecond (fast tools, fast models).
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-14T00:00:00.000Z') });
    try {
      observerSeen.length = 0;
      const backend = makeBackend();
      const prompts: string[] = [];
      const agent = new Agent({
        id: 'drop',
        name: 'drop',
        instructions: 'Use the bulk tool repeatedly.',
        model: loopModel(prompts, 6) as never,
        tools: { bulk: bulkTool },
        memory: backend.memory,
      });
      const memory = ids('drop');
      const before = bulkBatch;
      await agent.generate('Collect all the rows.', { memory, maxSteps: 10 });
      expect(bulkBatch - before).toBe(6);
      const firstTurn = prompts.length;
      await agent.generate('Thanks, anything else?', { memory, maxSteps: 10 });
      const nextTurn = prompts.slice(firstTurn).join();
      const seen = observerSeen.join('\n');
      const batches = Array.from({ length: 6 }, (_, i) => `batch${before + i + 1}x`);
      const lost = batches.filter(b => !nextTurn.includes(b) && !seen.includes(b));
      expect(lost).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe.skipIf(!live)('what the agent model sees', () => {
  // No accepted differences: every step of every turn must reach the model identically.
  it('is identical on every step of every turn for Memory and PlatformMemory', async () => {
    // Distinct thread per backend: OM keeps process-wide state keyed by thread, which would leak
    // from one in-process backend's run into the next. normalize() maps each run id to RUN.
    const stamp = Date.now();
    const turns = [
      'Hi, my name is Ada and I live in Kyoto.',
      'I work as a ceramicist and I love tea ceremonies.',
      'What should I cook tonight?',
      'Remind me what you know about me.',
      'Thanks, talk soon.',
    ];
    const seen: Record<string, string[][]> = {};
    for (const [name, make] of BACKENDS) {
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
      const run = `eq${stamp}${name}`;
      seen[name] = [];
      for (const turn of turns) {
        prompts.length = 0;
        await agent.generate(turn, { memory: { thread: `eq-${run}`, resource: `res-eq-${run}` } });
        seen[name].push(prompts.map(p => normalize(p, run)));
      }
    }
    if (process.env.PARITY_DUMP) writeFileSync(process.env.PARITY_DUMP, JSON.stringify(seen, null, 2));
    for (const [name] of BACKENDS.slice(1)) {
      for (let i = 0; i < turns.length; i++) {
        expect({ backend: name, turn: i, steps: seen[name]![i] }).toEqual({
          backend: name,
          turn: i,
          steps: seen.Memory![i],
        });
      }
    }
  }, 120_000);
});
