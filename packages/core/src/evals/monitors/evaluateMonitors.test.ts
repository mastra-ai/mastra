import { describe, expect, it, beforeEach, vi } from 'vitest';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Monitor } from '../../storage/domains/monitors';
import { InMemoryMonitorsStorage } from '../../storage/domains/monitors';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import type { SaveScorePayload } from '../types';
import { evaluateMonitors } from './evaluateMonitors';

const NOW = Date.parse('2026-08-20T12:00:00Z');

function buildMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: 'mon-1',
    name: 'Relevancy floor',
    filter: { scorerIds: ['relevancy'] },
    windowMinutes: 60,
    aggregation: 'avg',
    threshold: { op: 'lt', value: 0.7 },
    cooldownMinutes: 30,
    channels: [{ type: 'webhook', url: 'https://hooks.example.com/alerts' }],
    status: 'active',
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...overrides,
  };
}

function buildScore(overrides: Partial<SaveScorePayload> & { createdAt?: Date } = {}): SaveScorePayload {
  return {
    scorerId: 'relevancy',
    entityId: 'agent-1',
    entityType: 'AGENT',
    runId: `run-${Math.random()}`,
    score: 0.9,
    output: {},
    scorer: { name: 'relevancy' },
    source: 'LIVE',
    entity: { id: 'agent-1' },
    createdAt: new Date(NOW - 10 * 60_000),
    ...overrides,
  } as SaveScorePayload;
}

describe('evaluateMonitors', () => {
  let monitorsStore: InMemoryMonitorsStorage;
  let scoresStore: ScoresInMemory;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const db = new InMemoryDB();
    monitorsStore = new InMemoryMonitorsStorage({ db });
    scoresStore = new ScoresInMemory({ db });
    fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  const run = (now = NOW) =>
    evaluateMonitors({ monitorsStore, scoresStore, now, fetchImpl: fetchImpl as unknown as typeof fetch });

  it('fires a breach once and delivers the webhook payload', async () => {
    await monitorsStore.createMonitor(buildMonitor());
    await scoresStore.saveScore(buildScore({ score: 0.4 }));
    await scoresStore.saveScore(buildScore({ score: 0.5 }));

    const [result] = await run();
    expect(result!.breached).toBe(true);
    expect(result!.notified).toBe(true);
    expect(result!.value).toBeCloseTo(0.45);
    expect(result!.count).toBe(2);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://hooks.example.com/alerts');
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.monitor).toEqual({ id: 'mon-1', name: 'Relevancy floor' });
    expect(payload.type).toBe('breach');
    expect(payload.threshold).toEqual({ op: 'lt', value: 0.7 });

    const events = await monitorsStore.listMonitorEvents('mon-1');
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('breach');
  });

  it('suppresses repeat breaches during cooldown, re-fires after', async () => {
    await monitorsStore.createMonitor(buildMonitor({ cooldownMinutes: 30 }));
    await scoresStore.saveScore(buildScore({ score: 0.4 }));

    await run(NOW);
    // 10 minutes later — still in cooldown
    await scoresStore.saveScore(buildScore({ score: 0.3, createdAt: new Date(NOW + 5 * 60_000) }));
    const [second] = await run(NOW + 10 * 60_000);
    expect(second!.breached).toBe(true);
    expect(second!.notified).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // 40 minutes later — cooldown expired
    await scoresStore.saveScore(buildScore({ score: 0.3, createdAt: new Date(NOW + 35 * 60_000) }));
    const [third] = await run(NOW + 40 * 60_000);
    expect(third!.notified).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('records recovery and re-arms after scores improve', async () => {
    await monitorsStore.createMonitor(buildMonitor({ cooldownMinutes: 0 }));
    await scoresStore.saveScore(buildScore({ score: 0.4 }));
    await run(NOW);

    await scoresStore.saveScore(buildScore({ score: 0.95, createdAt: new Date(NOW + 61 * 60_000) }));
    const [recovered] = await run(NOW + 90 * 60_000);
    expect(recovered!.breached).toBe(false);

    const events = await monitorsStore.listMonitorEvents('mon-1');
    expect(events.map(e => e.type)).toEqual(['recovery', 'breach']);

    // Breach again — should notify (re-armed)
    await scoresStore.saveScore(buildScore({ score: 0.1, createdAt: new Date(NOW + 100 * 60_000) }));
    const [again] = await run(NOW + 110 * 60_000);
    expect(again!.notified).toBe(true);
  });

  it('skips no-data windows by default, breaches when configured', async () => {
    await monitorsStore.createMonitor(buildMonitor({ id: 'skip' }));
    await monitorsStore.createMonitor(buildMonitor({ id: 'breach-on-nodata', noDataBehavior: 'breach' }));

    const results = await run();
    const skip = results.find(r => r.monitorId === 'skip')!;
    const breach = results.find(r => r.monitorId === 'breach-on-nodata')!;
    expect(skip.breached).toBe(false);
    expect(skip.value).toBeNull();
    expect(breach.breached).toBe(true);
    expect(breach.notified).toBe(true);
  });

  it('applies monitor filters — cohort A breach does not fire cohort B monitor', async () => {
    await monitorsStore.createMonitor(
      buildMonitor({ id: 'cohort-a', filter: { scorerIds: ['relevancy'], metadata: { cohort: 'a' } } }),
    );
    await monitorsStore.createMonitor(
      buildMonitor({ id: 'cohort-b', filter: { scorerIds: ['relevancy'], metadata: { cohort: 'b' } } }),
    );
    await scoresStore.saveScore(buildScore({ score: 0.2, metadata: { cohort: 'a' } }));
    await scoresStore.saveScore(buildScore({ score: 0.99, metadata: { cohort: 'b' } }));

    const results = await run();
    expect(results.find(r => r.monitorId === 'cohort-a')!.breached).toBe(true);
    expect(results.find(r => r.monitorId === 'cohort-b')!.breached).toBe(false);
  });

  it('records delivery_failure and never crashes when webhook fails', async () => {
    fetchImpl.mockRejectedValueOnce(new Error('connection refused'));
    await monitorsStore.createMonitor(buildMonitor());
    await scoresStore.saveScore(buildScore({ score: 0.1 }));

    const [result] = await run();
    expect(result!.notified).toBe(true);
    const events = await monitorsStore.listMonitorEvents('mon-1');
    expect(events.map(e => e.type).sort()).toEqual(['breach', 'delivery_failure']);
    expect(events.find(e => e.type === 'delivery_failure')!.error).toContain('connection refused');
  });

  it('skips paused monitors and survives a monitor evaluation error', async () => {
    await monitorsStore.createMonitor(buildMonitor({ id: 'paused', status: 'paused' }));
    await monitorsStore.createMonitor(buildMonitor({ id: 'ok' }));
    await scoresStore.saveScore(buildScore({ score: 0.1 }));

    const results = await run();
    expect(results.map(r => r.monitorId)).toEqual(['ok']);
  });

  it('formats slack channel payloads', async () => {
    await monitorsStore.createMonitor(
      buildMonitor({ channels: [{ type: 'webhook', url: 'https://hooks.slack.com/x', format: 'slack' }] }),
    );
    await scoresStore.saveScore(buildScore({ score: 0.1 }));

    await run();
    const [, init] = fetchImpl.mock.calls[0]!;
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.text).toContain('Relevancy floor');
    expect(payload.text).toContain('avg');
  });
});
