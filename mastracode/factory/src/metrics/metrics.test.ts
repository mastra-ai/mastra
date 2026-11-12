import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { metricsService, resolveMetricsConfig } from './config.js';
import { recordIntakeEvent, recordReconcileSweep } from './intake.js';
import { FactoryMetrics, installFactoryMetrics } from './metrics.js';
import { commandStepLabel, recordWorkspacePhase, workspacePhaseLabel } from './sandbox.js';
import { startFactoryMetrics } from './index.js';

type Emitted = { name: string; value: number; labels: Record<string, string> };

function capture() {
  const records: Emitted[] = [];
  const targets = {
    getMetrics: () => ({
      emit: (name: string, value: number, labels?: Record<string, string>) =>
        void records.push({ name, value, labels: labels ?? {} }),
    }),
    getLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
  };
  return { records, targets };
}

function fakePool() {
  return {
    totalCount: 3,
    idleCount: 2,
    waitingCount: 0,
    query: vi.fn(async (sql: string) => ({
      rows: sql.includes('pg_stat_activity')
        ? [
            {
              active: 1,
              idle_in_transaction: 0,
              waiting_on_lock: 0,
              longest_query_s: 5,
              longest_idle_transaction_s: 0.5,
            },
          ]
        : [],
    })),
  };
}

afterEach(() => installFactoryMetrics(new FactoryMetrics(undefined, 'all')));

describe('resolveMetricsConfig', () => {
  it('is off unless a group is asked for', () => {
    expect(resolveMetricsConfig(undefined, {})).toBeUndefined();
    expect(resolveMetricsConfig({ groups: [] }, {})).toBeUndefined();
    expect(resolveMetricsConfig({ groups: 'all' }, { FACTORY_METRICS: '0' })).toBeUndefined();
  });

  it('parses all, lists and unknown names, with env winning', () => {
    expect([...resolveMetricsConfig(undefined, { FACTORY_METRICS: 'all' })!.groups]).toHaveLength(6);
    const config = resolveMetricsConfig({ groups: ['process'] }, { FACTORY_METRICS: 'sandbox, intake,nope' })!;
    expect([...config.groups]).toEqual(['sandbox', 'intake']);
    expect(config.unknownGroups).toEqual(['nope']);
  });

  it('defaults and clamps the interval and cap', () => {
    const defaults = resolveMetricsConfig({ groups: 'all' }, {})!;
    expect(defaults.intervalMs).toBe(60_000);
    expect(defaults.maxPerMinute).toBe(500);
    const env = { FACTORY_METRICS_INTERVAL_MS: '1000', FACTORY_METRICS_MAX_PER_MIN: 'x' };
    const clamped = resolveMetricsConfig({ groups: 'all', intervalMs: 30_000 }, env)!;
    expect(clamped.intervalMs).toBe(15_000);
    expect(clamped.maxPerMinute).toBe(500);
  });
});

describe('metricsService', () => {
  it('maps MASTRA_WORKERS to the service label', () => {
    expect(metricsService({})).toBe('all');
    expect(metricsService({ MASTRA_WORKERS: 'false' })).toBe('api');
    expect(metricsService({ MASTRA_WORKERS: '' })).toBe('worker');
    expect(metricsService({ MASTRA_WORKERS: 'a,b' })).toBe('worker');
  });
});

describe('FactoryMetrics', () => {
  it('aggregates counts and timings into one record per series, labeled with the service', async () => {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['intake', 'sandbox'] }, {}), 'worker');
    const { records, targets } = capture();
    metrics.start(targets, []);
    for (let i = 0; i < 50; i++) metrics.count('intake', 'events', { source: 'github' });
    for (const ms of [10, 20, 30]) metrics.observe('sandbox', 'phase_ms', ms, { phase: 'setup' });
    await metrics.tick();
    metrics.stop();

    expect(records).toContainEqual({ name: 'events', value: 50, labels: { source: 'github', service: 'worker' } });
    const phase = Object.fromEntries(records.filter(r => r.name === 'phase_ms').map(r => [r.labels.stat, r.value]));
    expect(phase).toEqual({ count: 3, avg: 20, p95: 30, max: 30 });
    expect(records).toHaveLength(5);
  });

  it('records nothing for a group that is off', async () => {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['process'] }, {}), 'all');
    const { records, targets } = capture();
    metrics.start(targets, []);
    metrics.count('intake', 'events');
    await metrics.tick();
    metrics.stop();
    expect(records).toEqual([]);
  });

  it('starts no timer when metrics are off', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const metrics = new FactoryMetrics(undefined, 'all');
    expect(
      startFactoryMetrics(metrics, capture().targets, { storage: undefined, vector: undefined, pubsub: undefined }),
    ).toBeTypeOf('function');
    metrics.start(capture().targets, []);
    expect(setInterval).not.toHaveBeenCalled();
    setInterval.mockRestore();
  });

  it('caps records per tick and counts the overflow', async () => {
    // 15s interval at 20/min = 5 records per tick, one of them held back for the dropped count.
    const metrics = new FactoryMetrics(
      resolveMetricsConfig({ groups: ['intake'], intervalMs: 15_000, maxRecordsPerMinute: 20 }, {}),
      'all',
    );
    const { records, targets } = capture();
    metrics.start(targets, []);
    for (let i = 0; i < 8; i++) metrics.count('intake', `events_${i}`);
    await metrics.tick();
    metrics.stop();
    expect(records.filter(r => r.name.startsWith('events_'))).toHaveLength(4);
    expect(records).toHaveLength(5);
    expect(records).toContainEqual({
      name: 'mastra_factory_metrics_dropped_total',
      value: 4,
      labels: { service: 'all' },
    });
  });
});

describe('startFactoryMetrics', () => {
  it('skips server-wide Postgres stats on the api service but keeps per-process pool stats', async () => {
    for (const service of ['api', 'worker'] as const) {
      const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['postgres'] }, {}), service);
      const pool = fakePool();
      const { records, targets } = capture();
      const stop = startFactoryMetrics(metrics, targets, { storage: { pool }, vector: undefined, pubsub: undefined });
      await metrics.tick();
      await stop();
      expect(records.some(r => r.name === 'mastra_factory_db_pool')).toBe(true);
      expect(records.some(r => r.name === 'mastra_factory_db_sessions')).toBe(service === 'worker');
      if (service === 'worker') {
        expect(records).toContainEqual({
          name: 'mastra_factory_db_longest_ms',
          value: 5000,
          labels: { kind: 'query', service },
        });
        expect(records).toContainEqual({
          name: 'mastra_factory_db_longest_ms',
          value: 500,
          labels: { kind: 'idle_transaction', service },
        });
      }
    }
  });
});

describe('call-site helpers', () => {
  it('maps workspace phases to closed labels and ignores boot phases', () => {
    expect(workspacePhaseLabel('workspace.sync(acme/private-repo)')).toBe('sync');
    expect(workspacePhaseLabel('workspace.onStart(created)')).toBe('on_start');
    expect(workspacePhaseLabel('workspace.setup-marker')).toBe('setup_marker');
    expect(workspacePhaseLabel('prepare.storage.init')).toBeUndefined();
    expect(commandStepLabel('repository clone')).toBe('clone');
    expect(commandStepLabel('environment branch fetch')).toBe('fetch');
    expect(commandStepLabel('something else')).toBe('other');
  });

  it('sends phase, intake and replay metrics through the installed instance without repo names', async () => {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['sandbox', 'intake'] }, {}), 'all');
    installFactoryMetrics(metrics);
    const { records, targets } = capture();
    metrics.start(targets, []);
    recordWorkspacePhase('workspace.sync(acme/private-repo)', 120, true);
    recordIntakeEvent('github', 'committed');
    recordReconcileSweep('github', 'merge_close', { replayed: 2, ok: true });
    await metrics.tick();
    metrics.stop();

    const names = new Set(records.map(r => r.name));
    expect(names).toContain('mastra_factory_sandbox_phase_ms');
    expect(names).toContain('mastra_factory_intake_events_total');
    expect(names).toContain('mastra_factory_intake_replayed_total');
    expect(JSON.stringify(records)).not.toContain('acme');
  });
});

describe('process collector', () => {
  it('reports GC pauses by kind, main-thread utilization, the CPU limit and the heap limit', async () => {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['process'] }, {}), 'all');
    const { records, targets } = capture();
    const stop = startFactoryMetrics(metrics, targets, { storage: undefined, vector: undefined, pubsub: undefined });
    // Force a collection instead of hoping allocation triggers one.
    setFlagsFromString('--expose-gc');
    (runInNewContext('gc') as () => void)();
    // GC entries are delivered asynchronously.
    await vi.waitFor(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      await metrics.tick();
      expect(records.some(r => r.name === 'mastra_factory_gc_ms')).toBe(true);
    });
    await stop();

    const utilization = records.find(r => r.name === 'mastra_factory_event_loop_utilization');
    expect(utilization?.value).toBeGreaterThanOrEqual(0);
    expect(utilization?.value).toBeLessThanOrEqual(1);
    expect(records.find(r => r.name === 'mastra_factory_process_cpu_limit_cores')?.value).toBeGreaterThan(0);
    const gc = records.filter(r => r.name === 'mastra_factory_gc_ms');
    expect(gc.length).toBeGreaterThan(0);
    expect(gc.every(r => ['minor', 'major', 'incremental', 'weakcb', 'other'].includes(r.labels.kind!))).toBe(true);
    expect(records.some(r => r.name === 'mastra_factory_process_memory_bytes' && r.labels.kind === 'heap_limit')).toBe(
      true,
    );
  });
});

describe('first-message capture', () => {
  it('asks storage for the creation time only when the sessions group is on', async () => {
    const { observeSessionFirstMessage } = await import('../session/first-message-capture.js');
    for (const groups of [['process'], ['sessions']] as const) {
      installFactoryMetrics(new FactoryMetrics(resolveMetricsConfig({ groups: [...groups] }, {}), 'all'));
      let listener: ((event: never) => void) | undefined;
      const markFirstMessage = vi.fn().mockResolvedValue(undefined);
      observeSessionFirstMessage(
        { identity: { getId: () => 's1' }, subscribe: l => ((listener = l as never), () => {}) },
        { sourceControl: { sessions: { markFirstMessage } } },
      );
      listener!({ type: 'message_start', message: { role: 'assistant' } } as never);
      expect(markFirstMessage).toHaveBeenCalledWith(
        groups[0] === 'sessions' ? { sessionId: 's1', withCreatedAt: true } : { sessionId: 's1' },
      );
    }
  });
});

describe('session latency', () => {
  it('records time to first message when the stamping call returns the creation time', async () => {
    const { observeSessionFirstMessage } = await import('../session/first-message-capture.js');
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['sessions'] }, {}), 'all');
    installFactoryMetrics(metrics);
    const { records, targets } = capture();
    metrics.start(targets, []);
    let listener: ((event: never) => void) | undefined;
    const markFirstMessage = vi.fn().mockResolvedValue(new Date(Date.now() - 1_000));
    observeSessionFirstMessage(
      { identity: { getId: () => 's1' }, subscribe: l => ((listener = l as never), () => {}) },
      { sourceControl: { sessions: { markFirstMessage } } },
    );
    listener!({ type: 'message_start', message: { role: 'user' } } as never);
    await vi.waitFor(() => expect(markFirstMessage).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 0));
    await metrics.tick();
    metrics.stop();
    const max = records.find(r => r.name === 'mastra_factory_session_first_message_ms' && r.labels.stat === 'max');
    expect(max?.value).toBeGreaterThanOrEqual(1_000);
  });

  it('records time to first exec when the stamping call returns the creation time', async () => {
    const { observeSessionFirstExec } = await import('../session/first-exec-capture.js');
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['sessions'] }, {}), 'all');
    installFactoryMetrics(metrics);
    const { records, targets } = capture();
    metrics.start(targets, []);
    const markFirstMeaningfulExec = vi.fn().mockResolvedValue(new Date(Date.now() - 2_000));
    let listener: ((event: never) => void) | undefined;
    observeSessionFirstExec(
      { identity: { getId: () => 's1' }, subscribe: l => ((listener = l as never), () => {}) } as never,
      { sourceControl: { sessions: { markFirstMeaningfulExec } } },
    );
    listener!({ type: 'tool_start', toolCallId: 'c1', toolName: 'view', args: {} } as never);
    listener!({ type: 'tool_end', toolCallId: 'c1', result: null, isError: false } as never);
    await vi.waitFor(() =>
      expect(markFirstMeaningfulExec).toHaveBeenCalledWith({ sessionId: 's1', withCreatedAt: true }),
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    await metrics.tick();
    metrics.stop();
    const max = records.find(r => r.name === 'mastra_factory_session_first_exec_ms' && r.labels.stat === 'max');
    expect(max?.value).toBeGreaterThanOrEqual(2_000);
  });
});

describe('sandbox retirement', () => {
  it('counts a retirement only when there was a session to retire', async () => {
    const { SessionRetirementCoordinator } = await import('../sandbox/session-retirement.js');
    const { SourceControlStorageInMemory } = await import('../storage/domains/source-control/inmemory.js');
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['sandbox'] }, {}), 'all');
    installFactoryMetrics(metrics);
    const { records, targets } = capture();
    metrics.start(targets, []);
    await new SessionRetirementCoordinator({ sandbox: {} as never }).retireSession({
      sourceControl: new SourceControlStorageInMemory(),
      orgId: 'org-1',
      sessionId: 'missing-session',
    });
    await metrics.tick();
    metrics.stop();
    expect(records.some(r => r.name === 'mastra_factory_sandbox_retired_total')).toBe(false);
  });
});

describe('cap across ticks', () => {
  it('holds a cap below one record per tick over a minute', async () => {
    // 1 record per minute at a 15s interval: one record every fourth tick.
    const metrics = new FactoryMetrics(
      resolveMetricsConfig({ groups: ['intake'], intervalMs: 15_000, maxRecordsPerMinute: 1 }, {}),
      'all',
    );
    const { records, targets } = capture();
    metrics.start(targets, []);
    for (let tick = 0; tick < 4; tick++) {
      metrics.count('intake', 'events');
      metrics.count('intake', 'other');
      await metrics.tick();
    }
    metrics.stop();
    expect(records).toHaveLength(1);
  });

  it('logs and keeps running when a scheduled tick fails', async () => {
    vi.useFakeTimers();
    try {
      const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['intake'], intervalMs: 15_000 }, {}), 'all');
      const warn = vi.fn();
      metrics.start(
        {
          getMetrics: () => {
            throw new Error('exporter broke');
          },
          getLogger: () => ({ info: vi.fn(), warn }),
        },
        [],
      );
      await vi.advanceTimersByTimeAsync(15_000);
      metrics.stop();
      expect(warn).toHaveBeenCalledWith('[factory:metrics] Metrics tick failed.', { error: 'Error: exporter broke' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('intake sweep age', () => {
  it('tracks each sweep kind separately', async () => {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['intake'] }, {}), 'all');
    installFactoryMetrics(metrics);
    const { records, targets } = capture();
    const stop = startFactoryMetrics(metrics, targets, { storage: undefined, vector: undefined, pubsub: undefined });
    recordReconcileSweep('github', 'merge_close', { replayed: 0, ok: true });
    recordReconcileSweep('github', 'open', { replayed: 0, ok: true });
    await metrics.tick();
    await stop();
    const kinds = records.filter(r => r.name === 'mastra_factory_intake_last_sweep_age_s').map(r => r.labels.kind);
    expect(kinds.sort()).toEqual(['merge_close', 'open']);
  });
});

describe('config', () => {
  it('caps the interval at the longest delay setInterval accepts', () => {
    expect(resolveMetricsConfig({ groups: 'all' }, { FACTORY_METRICS_INTERVAL_MS: '2147483648' })!.intervalMs).toBe(
      2_147_483_647,
    );
  });
});

describe('redis collectors', () => {
  function fakeRedis(xInfoGroups: () => Promise<unknown>, cluster = false) {
    const client = {
      connect: async () => {},
      info: async () => 'used_memory:100\r\nmaxmemory:1000\r\nconnected_clients:3\r\nevicted_keys:0\r\n',
      xInfoGroups,
      on: () => client,
      destroy: () => {},
      ...(cluster ? { masters: [] } : {}),
    };
    return { createMonitorClient: () => client, streamKey: (topic: string) => `mastra:topic:${topic}` };
  }

  async function collect(pubsub: unknown) {
    const metrics = new FactoryMetrics(resolveMetricsConfig({ groups: ['redis'] }, {}), 'all');
    const { records, targets } = capture();
    const stop = startFactoryMetrics(metrics, targets, { storage: undefined, vector: undefined, pubsub });
    await metrics.tick();
    await stop();
    return records;
  }

  it('treats a missing stream as empty but reports other XINFO errors as a failed check', async () => {
    const missing = await collect(fakeRedis(() => Promise.reject(new Error('ERR no such key'))));
    expect(missing.some(r => r.name === 'mastra_factory_probe_failures_total')).toBe(false);
    const denied = await collect(fakeRedis(() => Promise.reject(new Error('NOPERM no permission'))));
    expect(denied).toContainEqual({
      name: 'mastra_factory_probe_failures_total',
      value: 1,
      labels: { component: 'redis_streams', reason: 'error', service: 'all' },
    });
  });

  it('only runs the probe on a cluster', async () => {
    const records = await collect(fakeRedis(async () => [], true));
    expect(records.some(r => r.labels.component === 'redis')).toBe(true);
    expect(records.some(r => r.name === 'mastra_factory_redis_memory_bytes')).toBe(false);
  });
});
