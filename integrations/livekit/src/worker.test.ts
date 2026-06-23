import { InferenceRunner } from '@livekit/agents';
import type { JobContext, JobProcess } from '@livekit/agents';
import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveKitWorker } from './worker';
import { workerSetupComplete } from './worker-setup';

function fakeMastra(overrides: Partial<Record<'getAgentById' | 'getAgent', unknown>> = {}): Mastra {
  return {
    getAgentById: vi.fn(() => {
      throw new Error('not found');
    }),
    getAgent: vi.fn(() => {
      throw new Error('not found');
    }),
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
