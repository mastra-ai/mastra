import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveScorePayload } from '../../evals/types';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Monitor } from '../../storage/domains/monitors';
import { InMemoryMonitorsStorage } from '../../storage/domains/monitors';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import type { WorkerDeps } from '../worker';
import { MonitorWorker } from './monitor-worker';

function buildMonitor(overrides: Partial<Monitor> = {}): Monitor {
  const now = Date.now();
  return {
    id: 'mon-1',
    name: 'Relevancy floor',
    filter: { scorerIds: ['relevancy'] },
    windowMinutes: 60,
    aggregation: 'avg',
    threshold: { op: 'lt', value: 0.7 },
    channels: [{ type: 'webhook', url: 'https://hooks.example.com/alerts' }],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildScore(overrides: Partial<SaveScorePayload> = {}): SaveScorePayload {
  return {
    scorerId: 'relevancy',
    entityId: 'agent-1',
    entityType: 'AGENT',
    runId: `run-${Math.random()}`,
    score: 0.2,
    output: {},
    scorer: { name: 'relevancy' },
    source: 'LIVE',
    entity: { id: 'agent-1' },
    ...overrides,
  } as SaveScorePayload;
}

describe('MonitorWorker', () => {
  let monitorsStore: InMemoryMonitorsStorage;
  let scoresStore: ScoresInMemory;
  let worker: MonitorWorker;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const db = new InMemoryDB();
    monitorsStore = new InMemoryMonitorsStorage({ db });
    scoresStore = new ScoresInMemory({ db });
    fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchImpl);

    worker = new MonitorWorker({ intervalMs: 1000, jitterMs: 0 });
    const deps = {
      storage: {
        getStore: async (name: string) => {
          if (name === 'monitors') return monitorsStore;
          if (name === 'scores') return scoresStore;
          return undefined;
        },
      },
      logger: { error: vi.fn(), warn: vi.fn() },
      pubsub: {},
    } as unknown as WorkerDeps;
    await worker.init(deps);
  });

  afterEach(async () => {
    await worker.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('tick evaluates monitors and records a breach', async () => {
    await monitorsStore.createMonitor(buildMonitor());
    await scoresStore.saveScore(buildScore());

    await worker.tick();

    const events = await monitorsStore.listMonitorEvents('mon-1');
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('breach');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('tick no-ops without a monitors store', async () => {
    const bare = new MonitorWorker();
    await bare.init({
      storage: { getStore: async () => undefined },
      logger: { error: vi.fn() },
      pubsub: {},
    } as unknown as WorkerDeps);
    await expect(bare.tick()).resolves.toBeUndefined();
  });

  it('start schedules periodic evaluation and stop halts it', async () => {
    vi.useFakeTimers();
    await monitorsStore.createMonitor(buildMonitor());
    await scoresStore.saveScore(buildScore());

    await worker.start();
    expect(worker.isRunning).toBe(true);

    await vi.advanceTimersByTimeAsync(1100);
    const events = await monitorsStore.listMonitorEvents('mon-1');
    expect(events.length).toBeGreaterThanOrEqual(1);

    await worker.stop();
    expect(worker.isRunning).toBe(false);
    const countAfterStop = (await monitorsStore.listMonitorEvents('mon-1')).length;
    await vi.advanceTimersByTimeAsync(5000);
    expect((await monitorsStore.listMonitorEvents('mon-1')).length).toBe(countAfterStop);
  });
});
