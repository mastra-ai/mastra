/**
 * A second message sent while a run is still answering on the same thread must
 * wait for that run, as it does on a plain Agent (#30069). Running both at once
 * interleaves the thread's history ([user, user, assistant, assistant]) and
 * answers the second message without the first answer in its prompt.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LanguageModelV2, LanguageModelV2Prompt, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

const THREAD = 'busy-thread';
const RESOURCE = 'busy-resource';

type CallLog = { events: string[]; prompts: string[] };

// Streams `reply-<n>` word by word with a delay, so the first run is still
// answering when the second message arrives.
function createSlowModel(log: CallLog) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      const call = ++calls;
      log.prompts.push(JSON.stringify(prompt));
      log.events.push(`start-${call}`);
      const words = Array.from({ length: 6 }, (_, i) => `reply-${call}-word-${i} `);
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 't' });
          for (const word of words) {
            await new Promise(resolve => setTimeout(resolve, 20));
            controller.enqueue({ type: 'text-delta', id: 't', delta: word });
          }
          controller.enqueue({ type: 'text-end', id: 't' });
          log.events.push(`end-${call}`);
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  }) as unknown as LanguageModelV2;
}

const pubsubs: Array<EventEmitterPubSub | UnixSocketPubSub> = [];

afterEach(async () => {
  for (const pubsub of pubsubs.splice(0)) await pubsub.close();
});

async function setup(kind: 'durable' | 'evented') {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  await memory.createThread({ threadId: THREAD, resourceId: RESOURCE });
  const log: CallLog = { events: [], prompts: [] };
  const agent = new Agent({
    id: `busy-${kind}-agent`,
    name: `busy-${kind}-agent`,
    instructions: 'Answer.',
    model: createSlowModel(log),
    memory,
  });
  const pubsub = new EventEmitterPubSub();
  pubsubs.push(pubsub);
  const durable = kind === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent, pubsub });
  new Mastra({ agents: { durable: durable as any }, storage, logger: false, pubsub });
  return { durable, memory, log };
}

async function rolesOf(memory: MockMemory) {
  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
  return messages.map(message => message.role);
}

const options = { memory: { thread: THREAD, resource: RESOURCE } };

describe.each(['durable', 'evented'] as const)('%s agent: second message on a busy thread', kind => {
  it('stream(): waits for the active run, then answers with its reply in history', async () => {
    const { durable, memory, log } = await setup(kind);

    const first = await durable.stream('first message', options);
    const firstText = first.output.text;
    // Send the second message while the first is still answering.
    while (!log.events.includes('start-1')) await new Promise(resolve => setTimeout(resolve, 5));
    await new Promise(resolve => setTimeout(resolve, 30));
    const secondPromise = durable.stream('second message', options);

    expect(await firstText).toContain('reply-1-word-5');
    const second = await secondPromise;
    expect(await second.output.text).toContain('reply-2-word-5');

    expect(log.events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    expect(log.prompts[1]).toContain('reply-1-word-0');
    await expect.poll(() => rolesOf(memory)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('generate(): waits for the active run, then answers with its reply in history', async () => {
    const { durable, memory, log } = await setup(kind);

    const firstPromise = durable.generate('first message', options);
    while (!log.events.includes('start-1')) await new Promise(resolve => setTimeout(resolve, 5));
    await new Promise(resolve => setTimeout(resolve, 30));
    const secondPromise = durable.generate('second message', options);

    expect((await firstPromise).text).toContain('reply-1-word-5');
    expect((await secondPromise).text).toContain('reply-2-word-5');

    expect(log.events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    expect(log.prompts[1]).toContain('reply-1-word-0');
    await expect.poll(() => rolesOf(memory)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('frees the thread when a run fails before it starts', async () => {
    const { durable, memory, log } = await setup(kind);
    vi.spyOn(memory, 'getThreadById').mockRejectedValueOnce(new Error('storage down'));

    await expect(durable.stream('lost message', options)).rejects.toThrow('storage down');

    const next = await durable.stream('next message', options);
    expect(await next.output.text).toContain('reply-1-word-5');
    expect(log.events).toEqual(['start-1', 'end-1']);
    await expect.poll(() => rolesOf(memory)).toEqual(['user', 'assistant']);
  });
});

describe('evented agent on a shared transport: thread held by another process', () => {
  let directory: string | undefined;
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('rejects the run without saving its message', async () => {
    directory = await mkdtemp(join(tmpdir(), 'mastra-busy-thread-'));
    const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
    pubsubs.push(pubsub);
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
    await memory.createThread({ threadId: THREAD, resourceId: RESOURCE });
    const log: CallLog = { events: [], prompts: [] };
    const agent = new Agent({
      id: 'shared',
      name: 'shared',
      instructions: 'Answer.',
      model: createSlowModel(log),
      memory,
    });
    const evented = createEventedAgent({ agent, pubsub });
    new Mastra({ agents: { evented }, storage, pubsub, logger: false });
    // Another process's run holds the thread; there is no local run to wait on.
    await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'other-run', THREAD, RESOURCE, 1);

    const { output } = await evented.stream('second message', options);
    const result: any = await output.getFullOutput().catch((error: unknown) => ({ error }));

    expect(String(result.error?.message ?? result.error)).toMatch(/thread lease is held/);
    expect(log.events).toEqual([]);
    expect(await rolesOf(memory)).toEqual([]);
  });
});
