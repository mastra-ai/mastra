/**
 * End-to-end rubric acceptance test for online scoring.
 *
 * Walks the full customer workflow across the new APIs:
 * 1. Live sampled scorer persists scores with lineage metadata (deployment, model, cohort)
 * 2. An external worker posts a score with grader lineage (idempotent, caller-supplied id)
 * 3. The aggregate API returns a trend split by cohort including both score sources
 * 4. A monitor on the cohort threshold fires a webhook
 * 5. Monitor event → filtered scores → trace → thread drill-down all resolve
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import type { Monitor } from '../storage/domains/monitors';
import { InMemoryMonitorsStorage } from '../storage/domains/monitors/inmemory';
import { ScoresInMemory } from '../storage/domains/scores/inmemory';
import { evaluateMonitors } from './monitors';
import type { SaveScorePayload } from './types';

const NOW = new Date('2026-08-20T12:00:00Z').getTime();

const liveScore = (overrides: Partial<SaveScorePayload> & { score: number }): SaveScorePayload =>
  ({
    scorerId: 'clinical-accuracy',
    runId: `run-${Math.random().toString(36).slice(2)}`,
    scorer: { id: 'clinical-accuracy', name: 'Clinical Accuracy' },
    source: 'LIVE',
    entityType: 'AGENT',
    entityId: 'triage-agent',
    entity: { id: 'triage-agent' },
    input: {},
    output: {},
    createdAt: new Date(NOW - 10 * 60 * 1000),
    ...overrides,
  }) as unknown as SaveScorePayload;

describe('online scoring rubric acceptance', () => {
  let db: InMemoryDB;
  let scores: ScoresInMemory;
  let monitors: InMemoryMonitorsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    scores = new ScoresInMemory({ db });
    monitors = new InMemoryMonitorsStorage({ db });
  });

  it('walks the full customer workflow: live scores → external score → segmented trend → monitor breach → drill-down', async () => {
    // 1. Live sampled scorer persists scores with lineage metadata
    await scores.saveScore(
      liveScore({
        score: 0.9,
        traceId: 'trace-a',
        threadId: 'thread-a',
        metadata: { deployment: 'v42', model: 'claude-sonnet-4-5', cohort: 'cardiology' },
      }),
    );
    await scores.saveScore(
      liveScore({
        score: 0.3,
        traceId: 'trace-b',
        threadId: 'thread-b',
        metadata: { deployment: 'v42', model: 'claude-sonnet-4-5', cohort: 'oncology' },
      }),
    );

    // 2. External worker (e.g. Temporal) posts a score with grader lineage — idempotent by caller-supplied id
    const externalPayload = liveScore({
      score: 0.2,
      source: 'EXTERNAL',
      traceId: 'trace-b',
      threadId: 'thread-b',
      metadata: { grader: 'dr-smith', temporalWorkflowId: 'wf-9', cohort: 'oncology' },
    });
    (externalPayload as { id?: string }).id = 'ext-score-1';
    const first = await scores.saveScore(externalPayload);
    const second = await scores.saveScore(externalPayload); // replay converges, no duplicate
    expect(second.score.id).toBe('ext-score-1');
    expect(second.score.createdAt).toEqual(first.score.createdAt);

    // 3. Aggregate API returns trend split by cohort, including both LIVE and EXTERNAL sources
    const trend = await scores.aggregateScores({
      bucket: 'day',
      groupBy: ['metadata:cohort'],
      filter: { startDate: new Date(NOW - 60 * 60 * 1000), endDate: new Date(NOW) },
    });
    const byCohort = Object.fromEntries(trend.rows.map(r => [r.groups?.[0], r]));
    expect(byCohort['cardiology']!.count).toBe(1);
    expect(byCohort['cardiology']!.avg).toBeCloseTo(0.9);
    expect(byCohort['oncology']!.count).toBe(2); // one live + one external
    expect(byCohort['oncology']!.avg).toBeCloseTo(0.25);

    // 4. Monitor on the oncology cohort threshold fires a webhook
    const monitor: Monitor = {
      id: 'mon-oncology',
      name: 'Oncology accuracy floor',
      filter: { metadata: { cohort: 'oncology' } },
      windowMinutes: 60,
      aggregation: 'avg',
      threshold: { op: 'lt', value: 0.5 },
      channels: [{ type: 'webhook', url: 'https://hooks.example.com/datadog' }],
      status: 'active',
      createdAt: NOW,
      updatedAt: NOW,
    };
    await monitors.createMonitor(monitor);

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const results = await evaluateMonitors({
      monitorsStore: monitors,
      scoresStore: scores,
      now: NOW,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.breached).toBe(true);
    expect(results[0]!.notified).toBe(true);
    expect(results[0]!.value).toBeCloseTo(0.25);
    expect(fetchImpl).toHaveBeenCalledWith('https://hooks.example.com/datadog', expect.anything());

    // 5. Monitor event → filtered scores → trace → thread drill-down all resolve
    const events = await monitors.listMonitorEvents('mon-oncology');
    const breach = events.find(e => e.type === 'breach');
    expect(breach).toBeDefined();

    // Re-apply the monitor's filter over the breach window to find matching scores
    const drillDown = await scores.listScores({
      filter: {
        ...monitor.filter,
        startDate: new Date(breach!.windowStart),
        endDate: new Date(breach!.windowEnd),
      },
      pagination: { page: 0, perPage: 100 },
    });
    expect(drillDown.scores).toHaveLength(2);
    // Every matching score links back to a trace and a thread
    for (const score of drillDown.scores) {
      expect(score.traceId).toBe('trace-b');
      expect(score.threadId).toBe('thread-b');
    }
    // Both sources are represented in the drill-down
    expect(new Set(drillDown.scores.map(s => s.source))).toEqual(new Set(['LIVE', 'EXTERNAL']));
  });
});
