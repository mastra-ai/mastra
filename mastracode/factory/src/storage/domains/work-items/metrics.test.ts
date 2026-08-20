import { describe, expect, it } from 'vitest';

import type { WorkItemRow, WorkItemStageEntry } from './base.js';
import { computeFactoryMetrics, parseMetricsRange } from './metrics.js';

/** Fixed "now" so every duration in the specs is deterministic. */
const NOW = new Date('2026-07-15T12:00:00.000Z');
/** Exclusive end of NOW's UTC day. */
const END_OF_TODAY = Date.parse('2026-07-16T00:00:00.000Z');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A UTC calendar window of `days` ending at NOW. */
function lastDays(days: number): { windowStart: number; windowEnd: number } {
  const todayStart = Date.parse(`${NOW.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return { windowStart: todayStart - (days - 1) * DAY, windowEnd: NOW.getTime() };
}

/** ISO timestamp `hours` before NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

/** A card the Factory ran — the population every metric is computed over. */
function makeItem(overrides: Partial<WorkItemRow>): WorkItemRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    orgId: 'org_1',
    createdBy: 'user_1',
    factoryProjectId: '00000000-0000-4000-8000-0000000000aa',
    externalSource: null,
    parentWorkItemId: null,
    title: 'Item',
    stages: ['intake'],
    stageHistory: [{ stage: 'intake', enteredAt: hoursAgo(1), by: 'user_1' }],
    sessions: { execute: { sessionId: 'session-1', branch: 'factory/1', threadId: 'thread-1', startedBy: 'user_1' } },
    metadata: {},
    createdAt: new Date(NOW.getTime() - HOUR),
    updatedAt: new Date(NOW.getTime() - HOUR),
    ...overrides,
  };
}

/** A completed item: created `createdHoursAgo` ago, done `doneHoursAgo` ago. */
function doneItem(id: string, createdHoursAgo: number, doneHoursAgo: number): WorkItemRow {
  const history: WorkItemStageEntry[] = [
    { stage: 'intake', enteredAt: hoursAgo(createdHoursAgo), exitedAt: hoursAgo(doneHoursAgo + 2), by: 'user_1' },
    { stage: 'execute', enteredAt: hoursAgo(doneHoursAgo + 2), exitedAt: hoursAgo(doneHoursAgo), by: 'user_1' },
    { stage: 'done', enteredAt: hoursAgo(doneHoursAgo), by: 'user_1' },
  ];
  return makeItem({
    id,
    stages: ['done'],
    stageHistory: history,
    createdAt: new Date(NOW.getTime() - createdHoursAgo * HOUR),
  });
}

describe('parseMetricsRange', () => {
  it('defaults to the last 30 days when from/to are absent', () => {
    expect(parseMetricsRange(undefined, undefined, NOW)).toEqual({
      windowStart: Date.parse('2026-06-16T00:00:00.000Z'),
      windowEnd: END_OF_TODAY,
    });
  });

  it('accepts explicit ISO from/to', () => {
    const from = '2026-07-01T00:00:00.000Z';
    const to = '2026-07-10T00:00:00.000Z';
    expect(parseMetricsRange(from, to, NOW)).toEqual({
      windowStart: Date.parse(from),
      windowEnd: Date.parse(to),
    });
  });

  it('treats a date-only to bound as the end of that UTC calendar day', () => {
    const range = parseMetricsRange('2026-07-01', '2026-07-10', NOW);

    expect(range).toEqual({
      windowStart: Date.parse('2026-07-01T00:00:00.000Z'),
      windowEnd: Date.parse('2026-07-11T00:00:00.000Z'),
    });
    expect(computeFactoryMetrics([], range)).toMatchObject({ daysCovered: 10 });
  });

  it('clamps a future end to the end of the current UTC day', () => {
    const future = new Date(NOW.getTime() + 5 * DAY).toISOString();
    expect(parseMetricsRange(undefined, future, NOW).windowEnd).toBe(END_OF_TODAY);
  });

  it('falls back to the default span when from is not before to', () => {
    const to = '2026-07-10T00:00:00.000Z';
    const from = '2026-07-12T00:00:00.000Z'; // after to
    expect(parseMetricsRange(from, to, NOW)).toEqual({
      windowStart: Date.parse(to) - 30 * DAY,
      windowEnd: Date.parse(to),
    });
  });

  it('caps the span at 366 days', () => {
    const from = new Date(NOW.getTime() - 500 * DAY).toISOString();
    expect(parseMetricsRange(from, undefined, NOW)).toEqual({
      windowStart: Date.parse('2025-07-15T00:00:00.000Z'),
      windowEnd: END_OF_TODAY,
    });
  });

  it('treats malformed values as absent', () => {
    expect(parseMetricsRange('nonsense', '', NOW)).toEqual({
      windowStart: Date.parse('2026-06-16T00:00:00.000Z'),
      windowEnd: END_OF_TODAY,
    });
  });

  it('rejects timezone-less datetimes so the window is deployment-independent', () => {
    // No Z/offset → Date.parse reads server-local; treated as absent (default window).
    expect(parseMetricsRange('2026-07-01T10:00:00', '2026-07-05T10:00:00', NOW)).toEqual({
      windowStart: Date.parse('2026-06-16T00:00:00.000Z'),
      windowEnd: END_OF_TODAY,
    });
    // An explicit offset is honored.
    expect(parseMetricsRange('2026-07-01T00:00:00+00:00', undefined, NOW).windowStart).toBe(
      Date.parse('2026-07-01T00:00:00Z'),
    );
  });
});

describe('computeFactoryMetrics', () => {
  it('given an empty board, then everything is zeroed with a gap-filled throughput series', () => {
    const metrics = computeFactoryMetrics([], lastDays(7));

    expect(metrics.daysCovered).toBe(7);
    expect(metrics.throughput).toHaveLength(7);
    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    // Series is oldest → newest, ending today (UTC).
    expect(metrics.throughput.at(-1)?.date).toBe('2026-07-15');
    expect(metrics.throughput[0]?.date).toBe('2026-07-09');
    expect(metrics.leadTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.sourceMix).toEqual([]);
    expect(metrics.agentCoverage).toEqual([]);
  });

  it('given synced cards nobody ran, then they are not the Factory’s numbers', () => {
    // The integrations mirror every upstream issue and PR onto the board. Only
    // the ones a run was started on are Factory work.
    const synced = {
      ...doneItem('00000000-0000-4000-8000-000000000002', 48, 2),
      sessions: {},
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:1' },
    };

    const ran = doneItem('00000000-0000-4000-8000-000000000001', 48, 2);
    const metrics = computeFactoryMetrics([ran, synced], lastDays(7));

    expect(metrics.leadTime.samples).toBe(1);
    expect(metrics.throughput.find(point => point.date === '2026-07-15')?.count).toBe(1);
    expect(metrics.sourceMix).toEqual([{ source: 'manual', count: 1 }]);
  });

  it('given completed items, then throughput buckets by UTC day and lead time spans creation → done', () => {
    const items = [
      doneItem('00000000-0000-4000-8000-000000000001', 48, 2), // done today, 46h lead
      doneItem('00000000-0000-4000-8000-000000000002', 60, 26), // done yesterday, 34h lead
      doneItem('00000000-0000-4000-8000-000000000003', 30, 26), // done yesterday, 4h lead
    ];

    const metrics = computeFactoryMetrics(items, lastDays(7));

    const byDate = Object.fromEntries(metrics.throughput.map(p => [p.date, p.count]));
    expect(byDate['2026-07-15']).toBe(1);
    expect(byDate['2026-07-14']).toBe(2);
    expect(metrics.leadTime.samples).toBe(3);
    expect(metrics.leadTime.medianMs).toBe(34 * HOUR);
    expect(metrics.leadTime.p90Ms).toBe(46 * HOUR);
  });

  it('given a board younger than the window, then the series starts at the first card', () => {
    // A 30-day window over a board whose first card is 30h old: the 28 days
    // before it existed could hold no completion, so they are not "0 per day".
    const metrics = computeFactoryMetrics([doneItem('00000000-0000-4000-8000-000000000001', 30, 2)], lastDays(30));

    expect(metrics.daysCovered).toBe(2);
    expect(metrics.throughput[0]?.date).toBe('2026-07-14');
  });

  it('given a done entry outside the window, then it does not count toward throughput or lead time', () => {
    const metrics = computeFactoryMetrics(
      [doneItem('00000000-0000-4000-8000-000000000001', 30 * 24, 10 * 24)],
      lastDays(7),
    );

    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    expect(metrics.leadTime.samples).toBe(0);
  });

  it('given an item pulled back out of done, then the day it shipped keeps its completion', () => {
    const item = makeItem({
      stages: ['review'],
      createdAt: new Date(NOW.getTime() - 10 * HOUR),
      stageHistory: [
        { stage: 'done', enteredAt: hoursAgo(5), exitedAt: hoursAgo(3), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(3), by: 'user_1' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(7));

    expect(metrics.leadTime.samples).toBe(1);
    expect(metrics.throughput.find(point => point.date === '2026-07-15')?.count).toBe(1);
  });

  it('given an item that shipped twice, then each completion is counted', () => {
    const item = makeItem({
      stages: ['done'],
      createdAt: new Date(NOW.getTime() - 40 * HOUR),
      stageHistory: [
        { stage: 'done', enteredAt: hoursAgo(30), exitedAt: hoursAgo(20), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(20), exitedAt: hoursAgo(5), by: 'user_1' },
        { stage: 'done', enteredAt: hoursAgo(5), by: 'user_1' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(7));

    expect(metrics.leadTime.samples).toBe(2);
    expect(metrics.throughput.find(point => point.date === '2026-07-14')?.count).toBe(1);
    expect(metrics.throughput.find(point => point.date === '2026-07-15')?.count).toBe(1);
  });

  it('given a corrupt stage-history timestamp, then aggregation fails loudly', () => {
    const item = makeItem({ stageHistory: [{ stage: 'triage', enteredAt: 'sometime', by: 'user_1' }] });

    expect(() => computeFactoryMetrics([item], lastDays(7))).toThrow(/Unparsable stage-history timestamp/);
  });

  it('given a corrupt stamp on an entry the window never reads, then it still fails loudly', () => {
    const item = makeItem({
      stageHistory: [{ stage: 'triage', enteredAt: hoursAgo(-48), exitedAt: 'whenever', by: 'user_1' }],
    });

    expect(() => computeFactoryMetrics([item], lastDays(7))).toThrow(/Unparsable stage-history timestamp/);
  });

  it('given items created inside and outside the window, then source mix only counts the window', () => {
    const githubIssue = (externalId: string) => ({
      integrationId: 'github',
      type: 'issue',
      externalId,
    });
    const insideWindow = new Date(NOW.getTime() - 20 * DAY);
    const items = [
      makeItem({
        id: '00000000-0000-4000-8000-000000000001',
        externalSource: githubIssue('1'),
        createdAt: insideWindow,
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000002',
        externalSource: githubIssue('2'),
        createdAt: insideWindow,
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000003',
        createdAt: insideWindow,
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000004',
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'LIN-1' },
        createdAt: new Date(NOW.getTime() - 40 * DAY),
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000005',
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'LIN-2' },
        createdAt: new Date(NOW.getTime() - DAY),
      }),
    ];

    const metrics = computeFactoryMetrics(items, {
      windowStart: NOW.getTime() - 30 * DAY,
      windowEnd: NOW.getTime() - 10 * DAY,
    });

    expect(metrics.sourceMix).toEqual([
      { source: 'github:issue', count: 2 },
      { source: 'manual', count: 1 },
    ]);
  });

  it('given a canceled item, then it is terminal but never a completion', () => {
    const canceled = makeItem({
      id: '00000000-0000-4000-8000-000000000001',
      stages: ['canceled'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(10), exitedAt: hoursAgo(4), by: 'user_1' },
        { stage: 'canceled', enteredAt: hoursAgo(4), by: 'user_1' },
      ],
    });

    const metrics = computeFactoryMetrics([canceled], lastDays(7));

    expect(metrics.throughput.every(point => point.count === 0)).toBe(true);
    expect(metrics.leadTime.samples).toBe(0);
  });

  it('given the rules engine queueing a stage the agent finishes, then the pass is the agent’s', () => {
    // Actor ids exactly as the transition service stamps them: the dispatcher
    // queues the card, the bound run's transition tool moves it on. Intake gets
    // no row — filing a card is not a pass through the pipeline.
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        {
          stage: 'intake',
          enteredAt: hoursAgo(10),
          exitedAt: hoursAgo(9),
          by: 'factory-rule-dispatcher',
          exitedBy: 'factory-rule-dispatcher',
        },
        {
          stage: 'triage',
          enteredAt: hoursAgo(9),
          exitedAt: hoursAgo(8),
          by: 'factory-rule-dispatcher',
          exitedBy: 'agent:binding-1',
        },
        { stage: 'execute', enteredAt: hoursAgo(8), by: 'agent:binding-1' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(7));

    expect(metrics.agentCoverage).toEqual([
      { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
    ]);
  });

  it('given a stage the poller both opened and closed, then no agent handled it', () => {
    // The upstream sync moves cards on its own (a PR merged on GitHub lands the
    // card in done). Crediting the dispatcher would pin coverage near 100%.
    const item = makeItem({
      stages: ['review'],
      stageHistory: [
        {
          stage: 'triage',
          enteredAt: hoursAgo(9),
          exitedAt: hoursAgo(8),
          by: 'factory-rule-dispatcher',
          exitedBy: 'factory-rule-dispatcher',
        },
        { stage: 'review', enteredAt: hoursAgo(8), by: 'factory-rule-dispatcher' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(7));

    expect(metrics.agentCoverage).toEqual([
      { stage: 'triage', passes: 1, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
    ]);
  });

  describe('agentCoverage', () => {
    it('given an agent on part of the board, then only the stage it finished counts', () => {
      // Triage finished by the agent; planning handed back to a human to approve.
      const item = makeItem({
        stages: ['execute'],
        stageHistory: [
          {
            stage: 'triage',
            enteredAt: hoursAgo(9),
            exitedAt: hoursAgo(8),
            by: 'factory-rule-dispatcher',
            exitedBy: 'agent:binding-1',
          },
          {
            stage: 'planning',
            enteredAt: hoursAgo(8),
            exitedAt: hoursAgo(2),
            by: 'agent:binding-1',
            exitedBy: 'user_1',
          },
          { stage: 'execute', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.agentCoverage).toEqual([
        { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
        { stage: 'planning', passes: 1, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
      ]);
    });

    it('given a reworked stage, then the redo is reported as an outcome, not as a second denominator', () => {
      // First triage pass run by the agent, then the item bounced back through
      // triage, then went done. Reworked deliberately outranks done.
      const item = makeItem({
        stages: ['done'],
        stageHistory: [
          {
            stage: 'triage',
            enteredAt: hoursAgo(10),
            exitedAt: hoursAgo(9),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          {
            stage: 'triage',
            enteredAt: hoursAgo(8),
            exitedAt: hoursAgo(7),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          { stage: 'done', enteredAt: hoursAgo(6), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      // One pass, one card: counting the redo as a second exit would report 50%
      // coverage for a stage no human ever touched.
      expect(metrics.agentCoverage).toEqual([
        { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 0, canceled: 0, reworked: 1, inFlight: 0 } },
      ]);
    });

    it('given a pass a human finished or one still open, then no agent gets credit', () => {
      const items = [
        makeItem({
          id: '00000000-0000-4000-8000-000000000001',
          stages: ['planning'],
          stageHistory: [
            // Legacy entry: closed before exit stamping existed.
            { stage: 'triage', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'agent:binding-1' },
            { stage: 'planning', enteredAt: hoursAgo(8), by: 'user_1' },
          ],
        }),
        makeItem({
          id: '00000000-0000-4000-8000-000000000002',
          stages: ['planning'],
          stageHistory: [
            // The agent worked the stage but a human moved it on.
            {
              stage: 'triage',
              enteredAt: hoursAgo(9),
              exitedAt: hoursAgo(8),
              by: 'agent:binding-1',
              exitedBy: 'user_1',
            },
            { stage: 'planning', enteredAt: hoursAgo(8), by: 'user_1' },
          ],
        }),
      ];

      const metrics = computeFactoryMetrics(items, lastDays(7));

      expect(metrics.agentCoverage).toEqual([
        { stage: 'triage', passes: 2, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
      ]);
    });

    it('given agent passes with different endings, then outcomes classify done, canceled, and in flight', () => {
      const autoTriage = (id: string, stages: string[], tail: WorkItemStageEntry[]): WorkItemRow =>
        makeItem({
          id,
          stages,
          stageHistory: [
            {
              stage: 'triage',
              enteredAt: hoursAgo(9),
              exitedAt: hoursAgo(8),
              by: 'factory-rule-dispatcher',
              exitedBy: 'factory-tool-result-rule',
            },
            ...tail,
          ],
        });
      const items = [
        autoTriage(
          '00000000-0000-4000-8000-000000000001',
          ['done'],
          [{ stage: 'done', enteredAt: hoursAgo(2), by: 'user_1' }],
        ),
        autoTriage(
          '00000000-0000-4000-8000-000000000002',
          ['canceled'],
          [{ stage: 'canceled', enteredAt: hoursAgo(2), by: 'user_1' }],
        ),
        autoTriage(
          '00000000-0000-4000-8000-000000000003',
          ['planning'],
          [{ stage: 'planning', enteredAt: hoursAgo(2), by: 'user_1' }],
        ),
      ];

      const metrics = computeFactoryMetrics(items, lastDays(7));

      expect(metrics.agentCoverage).toEqual([
        { stage: 'triage', passes: 3, byAgent: 3, outcomes: { done: 1, canceled: 1, reworked: 0, inFlight: 1 } },
      ]);
    });

    it('given an item that landed after the window, then the outcome is the one the window saw', () => {
      // Agent triage pass inside the window; the card only reached done
      // afterwards, so re-querying the same window must keep reporting in flight.
      const item = makeItem({
        stages: ['done'],
        stageHistory: [
          {
            stage: 'triage',
            enteredAt: hoursAgo(30),
            exitedAt: hoursAgo(26),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          { stage: 'done', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], {
        windowStart: NOW.getTime() - 40 * HOUR,
        windowEnd: NOW.getTime() - 20 * HOUR,
      });

      expect(metrics.agentCoverage).toEqual([
        { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
      ]);
    });

    it('given exits outside the window, then they are not counted', () => {
      const item = makeItem({
        stages: ['planning'],
        stageHistory: [
          {
            stage: 'triage',
            enteredAt: hoursAgo(10 * 24),
            exitedAt: hoursAgo(8 * 24),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          { stage: 'planning', enteredAt: hoursAgo(8 * 24), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.agentCoverage).toEqual([]);
    });

    it('given visits to intake or terminal stages, then they never produce rows', () => {
      const item = makeItem({
        stages: ['triage'],
        stageHistory: [
          {
            stage: 'intake',
            enteredAt: hoursAgo(10),
            exitedAt: hoursAgo(9),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          { stage: 'done', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'factory', exitedBy: 'agent:binding-1' },
          {
            stage: 'canceled',
            enteredAt: hoursAgo(8),
            exitedAt: hoursAgo(2),
            by: 'factory',
            exitedBy: 'agent:binding-1',
          },
          { stage: 'triage', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.agentCoverage).toEqual([]);
    });
  });

  describe('funnel', () => {
    /** A card walked through `path`, an hour per stage, landing `endHoursAgo` ago. */
    function walked(suffix: number, path: string[], endHoursAgo = 1): WorkItemRow {
      const stageHistory: WorkItemStageEntry[] = path.map((stage, index) => ({
        stage,
        enteredAt: hoursAgo(endHoursAgo + path.length - index),
        ...(index < path.length - 1 ? { exitedAt: hoursAgo(endHoursAgo + path.length - index - 1) } : {}),
        by: 'user_1',
      }));
      return makeItem({
        id: `00000000-0000-4000-8000-00000000000${suffix}`,
        stages: [path.at(-1)!],
        stageHistory,
        createdAt: new Date(NOW.getTime() - (endHoursAgo + path.length) * HOUR),
      });
    }

    const gatesOf = (metrics: ReturnType<typeof computeFactoryMetrics>) =>
      Object.fromEntries(metrics.funnel.gates.map(gate => [gate.stage, gate]));

    it('given cards that stopped at different gates, then each drop is what stopped there', () => {
      const metrics = computeFactoryMetrics(
        [
          walked(1, ['triage', 'planning', 'execute', 'review', 'done']),
          walked(2, ['triage', 'planning']),
          walked(3, ['triage', 'canceled']),
        ],
        lastDays(7),
      );

      const gates = gatesOf(metrics);
      expect(gates.triage).toEqual({ stage: 'triage', reached: 3, canceled: 1, stalled: 0 });
      expect(gates.planning).toEqual({ stage: 'planning', reached: 2, canceled: 0, stalled: 1 });
      expect(gates.done?.reached).toBe(1);
    });

    it('given a card that skipped a stage, then it still counts as having got past it', () => {
      // Otherwise the band rises at the skipped gate and the figure reads as
      // more work arriving than was let in.
      const metrics = computeFactoryMetrics([walked(1, ['triage', 'execute', 'done'])], lastDays(7));

      expect(metrics.funnel.gates.map(gate => gate.reached)).toEqual([1, 1, 1, 1, 1]);
      expect(metrics.funnel.gates.every(gate => gate.canceled + gate.stalled === 0)).toBe(true);
    });

    it('given a card review sent back, then it counts once however far back it went, priced by the lap it redid', () => {
      const metrics = computeFactoryMetrics(
        [
          walked(1, ['triage', 'planning', 'execute', 'review', 'planning', 'execute', 'review', 'done']),
          walked(2, ['triage', 'planning', 'execute', 'review', 'done']),
        ],
        lastDays(7),
      );

      // one hour per stage, so the second lap through planning/execute/review
      // is the three hours the redo cost
      expect(metrics.funnel.rework).toEqual({ cards: 1, medianExtraMs: 3 * HOUR, percent: 50 });
    });

    it('given a card sent back to a stage it skipped, then the redo is still priced', () => {
      // Counting only repeat visits prices this send-back at nothing, and a
      // median over enough of them reports every redo on the board as free.
      const metrics = computeFactoryMetrics(
        [walked(1, ['triage', 'execute', 'planning', 'execute', 'review', 'done'])],
        lastDays(7),
      );

      expect(metrics.funnel.rework).toEqual({ cards: 1, medianExtraMs: 3 * HOUR, percent: 100 });
    });

    it('given a card that sat in intake for weeks, then its cohort is when it moved, not when it arrived', () => {
      const parked = makeItem({
        id: '00000000-0000-4000-8000-000000000001',
        stages: ['triage'],
        stageHistory: [
          { stage: 'intake', enteredAt: hoursAgo(40 * 24), exitedAt: hoursAgo(3), by: 'github' },
          { stage: 'triage', enteredAt: hoursAgo(3), by: 'user_1' },
        ],
        createdAt: new Date(NOW.getTime() - 40 * DAY),
      });

      const metrics = computeFactoryMetrics([parked, walked(2, ['triage', 'planning'], 20 * 24)], lastDays(7));

      expect(gatesOf(metrics).triage?.reached).toBe(1);
    });
  });

  describe('intake', () => {
    const synced = (suffix: number, stage: string, createdHoursAgo: number) =>
      makeItem({
        id: `00000000-0000-4000-8000-00000000000${suffix}`,
        sessions: {},
        stages: [stage],
        stageHistory: [{ stage, enteredAt: hoursAgo(createdHoursAgo), by: 'github' }],
        createdAt: new Date(NOW.getTime() - createdHoursAgo * HOUR),
      });

    it('given a board the integrations fill faster than the Factory drains it, then the queue is reported', () => {
      const metrics = computeFactoryMetrics(
        [
          doneItem('00000000-0000-4000-8000-000000000001', 3, 1),
          synced(2, 'intake', 3),
          synced(3, 'canceled', 3),
          synced(4, 'intake', 40 * 24),
        ],
        lastDays(7),
      );

      expect(metrics.intake).toEqual({ arrived: 3, pickedUp: 1, waiting: 2 });
    });
  });
});

describe('stage dwell', () => {
  it('reports how long a first visit held a card, per stage, in board order', () => {
    const item = makeItem({
      stages: ['done'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), exitedAt: hoursAgo(19), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(19), exitedAt: hoursAgo(9), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(9), exitedAt: hoursAgo(7), by: 'user_1' },
        { stage: 'done', enteredAt: hoursAgo(7), by: 'user_1' },
      ],
      createdAt: new Date(NOW.getTime() - 21 * HOUR),
    });

    expect(computeFactoryMetrics([item], lastDays(7)).stageDwell).toEqual([
      { stage: 'triage', medianMs: HOUR, p90Ms: HOUR },
      { stage: 'execute', medianMs: 10 * HOUR, p90Ms: 10 * HOUR },
      { stage: 'review', medianMs: 2 * HOUR, p90Ms: 2 * HOUR },
    ]);
  });

  it('given a stage nobody has left yet, then it holds no dwell at all', () => {
    // Otherwise a card that just entered would report the stage as instant.
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), exitedAt: hoursAgo(2), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(2), by: 'user_1' },
      ],
      createdAt: new Date(NOW.getTime() - 21 * HOUR),
    });

    expect(computeFactoryMetrics([item], lastDays(7)).stageDwell).toEqual([
      { stage: 'triage', medianMs: 18 * HOUR, p90Ms: 18 * HOUR },
    ]);
  });
});

describe('previous period', () => {
  it('reports the same span before the window, so a figure can be read as a trend', () => {
    const inWindow = doneItem('00000000-0000-4000-8000-000000000001', 20 * 24, 2 * 24);
    const before = doneItem('00000000-0000-4000-8000-000000000002', 21 * 24, 9 * 24);

    const metrics = computeFactoryMetrics([inWindow, before], lastDays(7));

    expect(metrics.previous).toEqual({
      agentCoveragePercent: 0,
      reworkPercent: 0,
      completed: 1,
      leadTimeMedianMs: 12 * DAY,
    });
  });

  it('given a board younger than two windows, then there is nothing to compare against', () => {
    // The missing days would read as growth from nothing rather than as no data.
    const metrics = computeFactoryMetrics(
      [doneItem('00000000-0000-4000-8000-000000000001', 3 * 24, 2 * 24)],
      lastDays(7),
    );

    expect(metrics.previous).toBeNull();
  });
});

describe('funnel edges', () => {
  it('reads a hop from the stage it left, so the wait and the actor are the departing stage’s', () => {
    // Attributing them to the arriving stage would report the time a card is
    // about to spend as the time it already spent.
    const item = makeItem({
      stages: ['review'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), exitedAt: hoursAgo(16), by: 'user_1', exitedBy: 'agent:binding-1' },
        { stage: 'execute', enteredAt: hoursAgo(16), exitedAt: hoursAgo(15), by: 'user_1', exitedBy: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(15), by: 'user_1' },
      ],
      createdAt: new Date(NOW.getTime() - 21 * HOUR),
    });

    expect(computeFactoryMetrics([item], lastDays(7)).funnel.edges).toEqual([
      { from: 'triage', to: 'execute', count: 1, byAgent: 1, dwellMedianMs: 4 * HOUR, dwellP90Ms: 4 * HOUR },
      { from: 'execute', to: 'review', count: 1, byAgent: 0, dwellMedianMs: HOUR, dwellP90Ms: HOUR },
    ]);
  });

  it('reports the hop that runs backwards, so a send-back can be drawn', () => {
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'triage', enteredAt: hoursAgo(20), exitedAt: hoursAgo(18), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(18), exitedAt: hoursAgo(10), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(10), exitedAt: hoursAgo(4), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(4), by: 'user_1' },
      ],
      createdAt: new Date(NOW.getTime() - 21 * HOUR),
    });

    const edges = computeFactoryMetrics([item], lastDays(7)).funnel.edges;

    expect(edges.map(edge => `${edge.from}\u2192${edge.to}`)).toContain('review\u2192execute');
  });
});

describe('series', () => {
  it('leaves a day with nothing to divide empty rather than plotting it as zero', () => {
    // A zero would draw the sparkline to the floor and read as "shipped instantly".
    const metrics = computeFactoryMetrics([doneItem('00000000-0000-4000-8000-000000000001', 30 * 24, 20)], lastDays(3));

    expect(metrics.series.leadTimeHours).toEqual([null, 30 * 24 - 20, 30 * 24 - 20]);
  });
});

describe('work board versus review board', () => {
  const PULL_REQUEST = { integrationId: 'github', type: 'pull-request', externalId: '1' };

  /** A review thread: filed, reviewed, done — it never sees the build stages. */
  function reviewThread(id: string, overrides: Partial<WorkItemRow> = {}): WorkItemRow {
    return makeItem({
      id,
      externalSource: PULL_REQUEST,
      stages: ['done'],
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(3), exitedAt: hoursAgo(2), by: 'user_1' },
        { stage: 'review', enteredAt: hoursAgo(2), exitedAt: hoursAgo(1), by: 'user_1' },
        { stage: 'done', enteredAt: hoursAgo(1), by: 'user_1' },
      ],
      createdAt: new Date(NOW.getTime() - 3 * HOUR),
      ...overrides,
    });
  }

  // Reviewing takes minutes and building takes days; a median over both is
  // neither number. Worse, the funnel credits a thread that only ever saw
  // `review` with the three build gates it skipped.
  it('keeps review threads out of the work board figures', () => {
    const metrics = computeFactoryMetrics(
      [doneItem('00000000-0000-4000-8000-00000000000a', 60, 12), reviewThread('00000000-0000-4000-8000-00000000000b')],
      lastDays(30),
    );

    expect(metrics.leadTime.samples).toBe(1);
    expect(metrics.leadTime.medianMs).toBe(48 * HOUR);
    expect(metrics.funnel.gates.map(gate => gate.reached)).toEqual([1, 1, 1, 1, 1]);
  });

  it('reports the review board on its own clock', () => {
    const metrics = computeFactoryMetrics(
      [
        reviewThread('00000000-0000-4000-8000-00000000000b'),
        makeItem({ id: '00000000-0000-4000-8000-00000000000c', externalSource: PULL_REQUEST, sessions: {} }),
      ],
      lastDays(30),
    );

    expect(metrics.review.completed).toBe(1);
    expect(metrics.review.leadTime.medianMs).toBe(2 * HOUR);
    expect(metrics.review.intake).toEqual({ arrived: 2, pickedUp: 1, waiting: 1 });
    // Covered days are the review board's own, so a board that opened this
    // morning is not read as one review across the whole 30-day window.
    expect(metrics.review.throughput).toEqual([{ date: NOW.toISOString().slice(0, 10), count: 1 }]);
  });

  // The Factory opens the pull request that ships a card of its own. Counting
  // it as review demand reports one delivery twice, once per board.
  it('leaves a pull request opened for its own card on neither board', () => {
    const metrics = computeFactoryMetrics(
      [
        doneItem('00000000-0000-4000-8000-00000000000a', 60, 12),
        reviewThread('00000000-0000-4000-8000-00000000000b', {
          parentWorkItemId: '00000000-0000-4000-8000-00000000000a',
        }),
      ],
      lastDays(30),
    );

    expect(metrics.leadTime.samples).toBe(1);
    expect(metrics.review.completed).toBe(0);
    expect(metrics.review.intake.arrived).toBe(0);
  });
});
