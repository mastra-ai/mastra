/**
 * Scenario: how long a message waits for the model's first output.
 *
 * Drives a real `AgentController` session, so the timer is checked against the events a real run
 * emits and the real `sendSignal` path. Only the model is a mock: the cases need a model whose
 * first output is text, a tool call, or nothing at all.
 */
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { resolveMetricsConfig } from './config.js';
import { FactoryMetrics, installFactoryMetrics } from './metrics.js';
import { instrumentSessionFirstOutput } from './session.js';

vi.setConfig({ testTimeout: 30_000 });

const NAME = 'mastra_factory_session_first_output_ms';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
type Emitted = { name: string; value: number; labels: Record<string, string> };
type Chunk = Record<string, unknown>;

function stream(chunks: Chunk[], gate?: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      for (const chunk of chunks) controller.enqueue(chunk);
      await gate;
      controller.close();
    },
  });
}

const text = (delta: string): Chunk[] => [
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta },
  { type: 'text-end', id: 'text-1' },
  { type: 'finish', finishReason: 'stop', usage },
];

const toolCall: Chunk[] = [
  { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
  { type: 'finish', finishReason: 'tool-calls', usage },
];

async function mount(
  respond: (call: number) => { chunks: Chunk[]; gate?: Promise<void> } | Error,
  groups: 'all' | [] = 'all',
) {
  const metrics = new FactoryMetrics(resolveMetricsConfig({ groups }, {}), 'all');
  installFactoryMetrics(metrics);
  const records: Emitted[] = [];
  metrics.start(
    {
      getMetrics: () => ({
        emit: (name: string, value: number, labels?: Record<string, string>) =>
          void records.push({ name, value, labels: labels ?? {} }),
      }),
      getLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
    },
    [],
  );

  let calls = 0;
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      const response = respond(calls++);
      if (response instanceof Error) throw response;
      return { stream: stream(response.chunks, response.gate) };
    },
  });
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    model,
    memory: new MockMemory({ storage }),
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Looks something up.',
        inputSchema: z.object({}),
        execute: async () => ({ found: true }),
      }),
    },
  });
  const mastra = new Mastra({ agents: { 'factory-agent': agent }, logger: false, storage });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('factory-agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'session-1', resourceId: 'project-1', ownerId: 'user-1' });
  await session.thread.create();
  const sendSignal = session.sendSignal;
  instrumentSessionFirstOutput(session);

  let ended = 0;
  const seen = new Set<string>();
  session.subscribe(event => {
    seen.add(event.type);
    if (event.type === 'agent_end') ended += 1;
  });
  const sawEvent = async (type: string) => {
    await vi.waitFor(() => expect(seen).toContain(type), { timeout: 10_000 });
  };
  const runEnded = async (count: number) => {
    await vi.waitFor(() => expect(ended).toBe(count), { timeout: 10_000 });
  };
  /** The timings sent since the last read: one `_count` record per series. */
  const timings = async () => {
    records.length = 0;
    await metrics.tick();
    return records.filter(r => r.name === `${NAME}_count`).map(r => ({ count: r.value, ...r.labels }));
  };
  return {
    session,
    runEnded,
    sawEvent,
    timings,
    patched: () => session.sendSignal !== sendSignal,
    stop: () => metrics.stop(),
  };
}

afterEach(() => installFactoryMetrics(new FactoryMetrics(undefined, 'all')));

describe('time to the first output of a session', () => {
  it('times each message sent to an idle session, the first one apart from later ones', async () => {
    const { session, runEnded, timings, stop } = await mount(() => ({ chunks: text('hello') }));

    await session.sendMessage({ content: 'first question' });
    await runEnded(1);
    expect(await timings()).toEqual([
      expect.objectContaining({ count: 1, turn: 'first', outcome: 'ok', first: 'text' }),
    ]);

    await session.sendMessage({ content: 'second question' });
    await runEnded(2);
    expect(await timings()).toEqual([
      expect.objectContaining({ count: 1, turn: 'later', outcome: 'ok', first: 'text' }),
    ]);
    stop();
  });

  it('counts a tool call as the first output when the model starts with one', async () => {
    const { session, sawEvent, timings, stop } = await mount(call =>
      call === 0 ? { chunks: toolCall } : { chunks: text('done') },
    );

    void session.sendMessage({ content: 'look it up' }).catch(() => undefined);
    await sawEvent('tool_start');

    expect(await timings()).toEqual([expect.objectContaining({ count: 1, outcome: 'ok', first: 'tool_call' })]);
    stop();
  });

  it('does not time a message that joins a run already in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const { session, sawEvent, timings, stop } = await mount(call =>
      call === 0 ? { chunks: text('working'), gate } : { chunks: text('and the follow-up') },
    );

    // A send settles when its run ends, so neither is awaited while the first run is held open.
    const first = session.sendMessage({ content: 'start working' });
    await sawEvent('message_update');
    expect(session.run.isRunning()).toBe(true);
    const second = session.sendMessage({ content: 'one more thing' });
    release();
    await Promise.all([first, second]);
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 10_000 });

    expect(await timings()).toEqual([expect.objectContaining({ count: 1, turn: 'first' })]);
    stop();
  });

  it('counts a run that ends before the model says anything', async () => {
    const { session, runEnded, timings, stop } = await mount(() => new Error('provider is down'));

    await session.sendMessage({ content: 'hello?' }).catch(() => undefined);
    await runEnded(1);

    expect(await timings()).toEqual([expect.objectContaining({ count: 1, turn: 'first', outcome: 'no_output' })]);
    stop();
  });

  it('leaves the session alone when the session group is off', async () => {
    const { patched } = await mount(() => ({ chunks: text('hello') }), []);
    expect(patched()).toBe(false);
  });
});
