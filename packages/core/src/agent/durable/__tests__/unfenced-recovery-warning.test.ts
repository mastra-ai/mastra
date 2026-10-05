/**
 * Recovery is only safe against a live execution when the stores a run writes
 * to can fence those writes (#23734). With a store that can't, DurableAgent
 * warns once per store, where the risk applies: when it recovers runs, and,
 * with `recovery.durableAgents: 'auto'`, when a run raises its memory fence.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { __resetExecutionFencesForTests } from '../execution-fence';
import { globalRunRegistry } from '../run-registry';

function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any;
}

function textModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as unknown as LanguageModelV2;
}

function unfenced(store: { supportsRunFencing(): boolean | Promise<boolean> }) {
  vi.spyOn(store, 'supportsRunFencing').mockReturnValue(false);
}

async function runOnThread(agent: ReturnType<typeof setup>['agents'][string], thread: string) {
  const result = await agent!.stream('hi', { memory: { thread, resource: 'r' } });
  for await (const _chunk of result.fullStream) {
    // drain
  }
}

function setup(args: { storage: InMemoryStore; memory?: MockMemory; recovery?: 'auto' | 'off'; agentIds?: string[] }) {
  const logger = fakeLogger();
  const pubsub = new EventEmitterPubSub();
  const agents = Object.fromEntries(
    (args.agentIds ?? ['agent-a']).map(id => [
      id,
      createDurableAgent({
        agent: new Agent({
          id,
          name: id,
          instructions: 'x',
          model: textModel(),
          ...(args.memory ? { memory: args.memory } : {}),
        }),
        pubsub,
      }),
    ]),
  );
  new Mastra({
    agents: agents as any,
    storage: args.storage,
    pubsub,
    logger,
    ...(args.recovery ? { recovery: { durableAgents: args.recovery } } : {}),
  });
  const warnings = () =>
    logger.warn.mock.calls.map((call: unknown[]) => String(call[0])).filter((m: string) => m.includes('fence'));
  return { agents, warnings, pubsub };
}

describe('DurableAgent warns about stores that cannot fence run writes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
    __resetExecutionFencesForTests();
  });

  it('warns once per store when recovering runs with a workflows store that cannot fence', async () => {
    const storage = new InMemoryStore();
    unfenced(storage.stores.workflows!);
    unfenced(storage.stores.memory!);
    const { agents, warnings } = setup({ storage, recovery: 'auto', agentIds: ['agent-a', 'agent-b'] });

    await agents['agent-a']!.recoverActiveRuns();
    await agents['agent-a']!.recoverActiveRuns();
    await agents['agent-b']!.recoverActiveRuns();

    // Without a fenced workflows store nothing is fenced, so the memory store is not reported separately.
    expect(warnings()).toEqual([expect.stringContaining('the workflows store (WorkflowsInMemory)')]);
    expect(warnings()[0]).toContain("can't fence run writes");
  });

  it('warns about a memory store that cannot fence when the workflows store can', async () => {
    const storage = new InMemoryStore();
    unfenced(storage.stores.memory!);
    const { agents, warnings } = setup({ storage });

    await agents['agent-a']!.recoverActiveRuns();

    expect(warnings()).toEqual([expect.stringContaining('the memory store (InMemoryMemory)')]);
  });

  it('with recovery auto, warns when a run uses agent memory on a store that cannot fence', async () => {
    const memoryStorage = new InMemoryStore();
    unfenced(memoryStorage.stores.memory!);
    const { agents, warnings, pubsub } = setup({
      storage: new InMemoryStore(),
      memory: new MockMemory({ storage: memoryStorage }),
      recovery: 'auto',
    });

    await runOnThread(agents['agent-a'], 't-1');
    await runOnThread(agents['agent-a'], 't-2');

    expect(warnings()).toEqual([expect.stringContaining('the memory store (InMemoryMemory)')]);
    await pubsub.close();
  });

  it("does not warn about a store that can't tell yet whether it fences", async () => {
    const storage = new InMemoryStore();
    vi.spyOn(storage.stores.workflows!, 'supportsRunFencing').mockRejectedValue(new Error('probe failed'));
    const { agents, warnings } = setup({ storage, recovery: 'auto' });

    await agents['agent-a']!.recoverActiveRuns();

    expect(warnings()).toEqual([]);
  });

  it('does not warn for runs when recovery is not auto, or when every store can fence', async () => {
    const memoryStorage = new InMemoryStore();
    unfenced(memoryStorage.stores.memory!);
    const off = setup({ storage: new InMemoryStore(), memory: new MockMemory({ storage: memoryStorage }) });
    await runOnThread(off.agents['agent-a'], 't');
    expect(off.warnings()).toEqual([]);

    const fenced = setup({ storage: new InMemoryStore(), memory: new MockMemory(), recovery: 'auto' });
    await runOnThread(fenced.agents['agent-a'], 't');
    await fenced.agents['agent-a']!.recoverActiveRuns();
    expect(fenced.warnings()).toEqual([]);

    await off.pubsub.close();
    await fenced.pubsub.close();
  });
});
