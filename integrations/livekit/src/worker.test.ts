import { InferenceRunner } from '@livekit/agents';
import type { JobContext, JobProcess } from '@livekit/agents';
import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveKitWorker, resolveMemoryInstance } from './worker';
import type { ResolveMastraAgentArgs } from './worker';
import { workerSetupComplete } from './worker-setup';

function fakeMastra(overrides: Partial<Record<'getAgentById' | 'getAgent' | 'getLogger', unknown>> = {}): Mastra {
  return {
    getAgentById: vi.fn(() => {
      throw new Error('not found');
    }),
    getAgent: vi.fn(() => {
      throw new Error('not found');
    }),
    getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    ...overrides,
  } as unknown as Mastra;
}

function fakeJobContext(metadata?: string): JobContext {
  return {
    job: { metadata },
    proc: { userData: {} },
    room: { name: 'room-1' },
    connect: vi.fn(async () => {}),
  } as unknown as JobContext;
}

describe('createLiveKitWorker', () => {
  // createLiveKitWorker prunes InferenceRunner.registeredRunners (a process-global), so
  // snapshot and restore it around each test to keep registry state from leaking between tests.
  let runnerSnapshot: Record<string, unknown>;
  beforeEach(() => {
    runnerSnapshot = { ...InferenceRunner.registeredRunners };
  });
  afterEach(() => {
    for (const key of Object.keys(InferenceRunner.registeredRunners)) {
      delete InferenceRunner.registeredRunners[key];
    }
    Object.assign(InferenceRunner.registeredRunners, runnerSnapshot);
  });

  it('registers only the requested turn detector inference runner before the server starts', async () => {
    createLiveKitWorker({ mastra: fakeMastra(), vad: false, turnDetection: 'multilingual' });
    // runLiveKitWorker awaits this before booting the agent server; the server only
    // spawns its inference process for runners registered by that point.
    await workerSetupComplete();
    const runners = Object.keys(InferenceRunner.registeredRunners);
    expect(runners).toContain('lk_end_of_utterance_multilingual');
    // The unused language model is pruned so the inference process doesn't demand its files.
    expect(runners).not.toContain('lk_end_of_utterance_en');
  });

  it('returns a LiveKit agent definition', () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    expect(typeof definition.entry).toBe('function');
    expect(typeof definition.prewarm).toBe('function');
  });

  it('rejects `generate` combined with `agent`', () => {
    expect(() => createLiveKitWorker({ mastra: fakeMastra(), generate: vi.fn(), agent: 'callCenter' })).toThrow(
      /exactly one reply generator/,
    );
  });

  it('rejects `generate` combined with `workflow`', () => {
    expect(() =>
      createLiveKitWorker({ mastra: fakeMastra(), generate: vi.fn(), workflow: 'phone', workflowInput: () => ({}) }),
    ).toThrow(/exactly one reply generator/);
  });

  it('rejects `agent` combined with `workflow`', () => {
    expect(() =>
      createLiveKitWorker({ mastra: fakeMastra(), agent: 'callCenter', workflow: 'phone', workflowInput: () => ({}) }),
    ).toThrow(/mutually exclusive/);
  });

  it('does not load a VAD during prewarm when vad is disabled', async () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    const proc = { userData: {} } as JobProcess<Record<string, unknown>>;
    await definition.prewarm?.(proc);
    expect(proc.userData.vad).toBeUndefined();
  });

  it('fails with a helpful error when no Mastra agent is specified', async () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    await expect(definition.entry(fakeJobContext())).rejects.toThrow(/no Mastra agent specified/);
  });

  it('resolves the agent by id and falls back to the registered key', async () => {
    const getAgent = vi.fn(() => {
      // Resolution succeeded; abort the session setup that follows.
      throw new Error('STOP_TEST');
    });
    const mastra = fakeMastra({ getAgent });
    const definition = createLiveKitWorker({ mastra, vad: false });
    const ctx = fakeJobContext(JSON.stringify({ agentId: 'support' }));
    await expect(definition.entry(ctx)).rejects.toThrow('STOP_TEST');
    expect(mastra.getAgentById).toHaveBeenCalledWith('support');
    expect(getAgent).toHaveBeenCalledWith('support');
  });

  it('registers an onCallEnd shutdown callback that runs the hook with the call context', async () => {
    const onCallEnd = vi.fn();
    const agent = { id: 'support', name: 'support', hasOwnMemory: () => false };
    const mastra = fakeMastra({ getAgentById: vi.fn(() => agent) });
    const shutdownCallbacks: Array<() => Promise<void>> = [];
    const ctx = {
      job: { metadata: JSON.stringify({ agentId: 'support' }) },
      proc: { userData: {} },
      room: { name: 'room-9' },
      connect: vi.fn(async () => {}),
      addShutdownCallback: vi.fn((cb: () => Promise<void>) => shutdownCallbacks.push(cb)),
    } as unknown as JobContext;

    const definition = createLiveKitWorker({ mastra, vad: false, observability: false, onCallEnd });
    // Session start fails without a real LiveKit room — but that's AFTER the shutdown callback is
    // registered up front, which is exactly what we assert. Memory is off (agent has none), so the
    // callback carries `memory: false` / `memoryInstance: null`.
    await definition.entry(ctx).catch(() => {});

    expect(shutdownCallbacks).toHaveLength(1);
    expect(onCallEnd).not.toHaveBeenCalled();
    await shutdownCallbacks[0]!();
    expect(onCallEnd).toHaveBeenCalledTimes(1);
    expect(onCallEnd.mock.calls[0]![0]).toMatchObject({ roomName: 'room-9', memory: false, memoryInstance: null });
  });
});

describe('resolveMemoryInstance', () => {
  const args = { metadata: {}, ctx: fakeJobContext() } as unknown as ResolveMastraAgentArgs;
  type Agent = Parameters<typeof resolveMemoryInstance>[1];
  type Options = Parameters<typeof resolveMemoryInstance>[0];
  type MemoryInstanceOption = NonNullable<Options['memoryInstance']>;

  const fakeStorage = { id: 'mastra-store' };
  const mastra = { getStorage: vi.fn(() => fakeStorage) } as unknown as Options['mastra'];
  // A storage-less Memory mirrors the real shape resolveMemoryInstance touches.
  const makeMemory = (hasOwnStorage: boolean) =>
    ({ hasOwnStorage, setStorage: vi.fn(), __registerMastra: vi.fn() }) as unknown as MemoryInstanceOption & {
      setStorage: ReturnType<typeof vi.fn>;
      __registerMastra: ReturnType<typeof vi.fn>;
    };

  it('sources the instance from the agent on the agent path', async () => {
    const memory = { id: 'agent-mem' };
    const agent = { getMemory: vi.fn(async () => memory) } as unknown as Agent;
    // The agent path leaves storage to agent.getMemory(); no injection here.
    expect(await resolveMemoryInstance({ mastra }, agent, args, undefined)).toBe(memory);
  });

  it('injects Mastra storage into a storage-less memoryInstance (instance form)', async () => {
    const memory = makeMemory(false);
    const result = await resolveMemoryInstance({ mastra, memoryInstance: memory }, undefined, args, undefined);
    expect(result).toBe(memory);
    expect(memory.__registerMastra).toHaveBeenCalledWith(mastra);
    expect(memory.setStorage).toHaveBeenCalledWith(fakeStorage);
  });

  it('does not override storage when the memory already has its own', async () => {
    const memory = makeMemory(true);
    await resolveMemoryInstance({ mastra, memoryInstance: memory }, undefined, args, undefined);
    expect(memory.setStorage).not.toHaveBeenCalled();
  });

  it('uses the memoryInstance option (resolver form) when there is no agent', async () => {
    const memory = makeMemory(false);
    const resolver = vi.fn(async () => memory) as unknown as MemoryInstanceOption;
    expect(await resolveMemoryInstance({ mastra, memoryInstance: resolver }, undefined, args, undefined)).toBe(memory);
  });

  it('returns null when there is no agent and no memoryInstance', async () => {
    expect(await resolveMemoryInstance({ mastra }, undefined, args, undefined)).toBeNull();
  });
});

describe('buildTurnHandling', () => {
  it('disables preemptive generation by default to avoid duplicate persisted messages', async () => {
    const { buildTurnHandling } = await import('./worker');
    expect(buildTurnHandling({}, undefined)).toEqual({ preemptiveGeneration: { enabled: false } });
  });

  it('lets callers opt back into preemptive generation', async () => {
    const { buildTurnHandling } = await import('./worker');
    const turnHandling = buildTurnHandling(
      { turnHandling: { preemptiveGeneration: { enabled: true }, endpointing: { minDelay: 300 } } },
      undefined,
    );
    expect(turnHandling).toEqual({
      preemptiveGeneration: { enabled: true },
      endpointing: { minDelay: 300 },
    });
  });
});
