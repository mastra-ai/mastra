import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { getMemoryRunState } from '../../../memory/run-state';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { prepareForDurableExecution } from '../preparation';
import { globalRunRegistry } from '../run-registry';
import { resolveRuntimeDependencies } from '../utils/resolve-runtime';

const runIds: string[] = [];
afterEach(() => {
  for (const id of runIds.splice(0)) globalRunRegistry.delete(id);
});

async function fixture() {
  const memory = new MockMemory();
  await memory.createThread({ threadId: 'thread', resourceId: 'owner' });
  const contexts: RequestContext[] = [];
  const agent = new Agent({
    id: 'memory-read-reuse',
    name: 'Memory read reuse',
    instructions: 'Reply briefly',
    model: new MockLanguageModelV2(),
    memory,
    inputProcessors: ({ requestContext }) => {
      contexts.push(requestContext);
      return [];
    },
  });
  const requestContext = new RequestContext();
  const prepare = (resource = 'owner') =>
    prepareForDurableExecution({
      agent,
      messages: 'Hello',
      requestContext,
      options: { memory: { thread: 'thread', resource } },
    });
  return { memory, agent, contexts, requestContext, prepare };
}

describe('durable memory read reuse', () => {
  it('shares concurrent reads within one preparation and omits live state from the snapshot', async () => {
    const f = await fixture();
    const prepared = await f.prepare();
    const state = getMemoryRunState(f.requestContext, f.memory, 'thread', 'owner');
    expect(state).toBeDefined();
    expect(state!.ownershipValidated).toBe(true);
    const load = vi.fn(async () => ({ notes: 'current' }));
    const [first, second] = await Promise.all([state!.load('record', load), state!.load('record', load)]);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    expect(getMemoryRunState(f.requestContext, f.memory, 'thread', 'other-owner')).toBeUndefined();
    const snapshot = JSON.parse(JSON.stringify(prepared.workflowInput));
    expect(snapshot.requestContextEntries?.MastraMemory?.runState).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('ownershipValidated');
  });

  it('reads fresh values on a later preparation even with the same RequestContext', async () => {
    const f = await fixture();
    await f.prepare();
    const first = getMemoryRunState(f.requestContext, f.memory, 'thread', 'owner')!;
    await first.load('record', async () => 'old');
    const later = await f.prepare();
    const second = getMemoryRunState(f.requestContext, f.memory, 'thread', 'owner')!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(await second.load('record', async () => 'new')).toBe('new');
    const snapshot = JSON.parse(JSON.stringify(later.workflowInput));
    // Current upstream rebuilds the whole framework memory context from run state.
    expect(snapshot.requestContextEntries?.MastraMemory).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('ownershipValidated');
  });

  it('keeps wrong-owner preparation blocked', async () => {
    const f = await fixture();
    await expect(f.prepare('other-owner')).rejects.toThrow();
    expect(getMemoryRunState(f.requestContext, f.memory, 'thread', 'other-owner')).toBeUndefined();
  });

  it('creates empty unvalidated state when a cold worker reconstructs a snapshot', async () => {
    const f = await fixture();
    const mastra = new Mastra({ agents: { agent: f.agent }, storage: new InMemoryStore({ id: 'memory-reuse' }) });
    const prepared = await f.prepare();
    const previous = getMemoryRunState(f.requestContext, f.memory, 'thread', 'owner')!;
    await previous.load('record', async () => 'old');
    const input = JSON.parse(JSON.stringify(prepared.workflowInput));
    runIds.push(prepared.runId);
    await resolveRuntimeDependencies({ mastra, runId: prepared.runId, agentId: f.agent.id, input });
    const restoredContext = f.contexts.at(-1)!;
    const restored = getMemoryRunState(restoredContext, f.memory, 'thread', 'owner')!;
    expect(restored).toBeDefined();
    expect(restored).not.toBe(previous);
    expect(restored.ownershipValidated).toBe(false);
    expect(restored.threadLoaded).toBe(false);
    expect(await restored.load('record', async () => 'fresh')).toBe('fresh');
  });
});
