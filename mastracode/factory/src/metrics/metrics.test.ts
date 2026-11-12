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
              longest_query_ms: 5,
              longest_idle_transaction_ms: 0,
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
    // 15s interval at 20/min = a budget of 5 per tick.
    const metrics = new FactoryMetrics(
      resolveMetricsConfig({ groups: ['intake'], intervalMs: 15_000, maxRecordsPerMinute: 20 }, {}),
      'all',
    );
    const { records, targets } = capture();
    metrics.start(targets, []);
    for (let i = 0; i < 8; i++) metrics.count('intake', `events_${i}`);
    await metrics.tick();
    metrics.stop();
    expect(records.filter(r => r.name.startsWith('events_'))).toHaveLength(5);
    expect(records).toContainEqual({
      name: 'mastra_factory_metrics_dropped_total',
      value: 3,
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
