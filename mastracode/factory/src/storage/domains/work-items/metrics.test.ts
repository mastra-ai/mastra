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

function makeItem(overrides: Partial<WorkItemRow>): WorkItemRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    orgId: 'org_1',
    createdBy: 'user_1',
    factoryProjectId: '00000000-0000-4000-8000-0000000000aa',
    externalSource: null,
    title: 'Item',
    stages: ['intake'],
    stageHistory: [{ stage: 'intake', enteredAt: hoursAgo(1), by: 'user_1' }],
    sessions: {},
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
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.sourceMix).toEqual([]);
    expect(metrics.transitions).toEqual({ human: 0, total: 0 });
    expect(metrics.stageAutomation).toEqual([]);
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
    // ...but it still isn't in-flight.
    expect(metrics.wipTotal).toBe(0);
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
    // Reopened, so it is in flight again — completion count and WIP disagree by design.
    expect(metrics.wipTotal).toBe(1);
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

  it('given multi-stage and terminal cards, then wipTotal counts distinct in-flight cards', () => {
    const items = [
      makeItem({
        id: '00000000-0000-4000-8000-000000000001',
        stages: ['review'],
        stageHistory: [{ stage: 'review', enteredAt: hoursAgo(70), by: 'user_1' }],
      }),
      makeItem({
        id: '00000000-0000-4000-8000-000000000002',
        stages: ['execute', 'review'],
        stageHistory: [
          { stage: 'execute', enteredAt: hoursAgo(20), by: 'user_1' },
          { stage: 'review', enteredAt: hoursAgo(4), by: 'user_1' },
        ],
      }),
      doneItem('00000000-0000-4000-8000-000000000003', 40, 2),
    ];

    const metrics = computeFactoryMetrics(items, lastDays(30));

    expect(metrics.wipTotal).toBe(2); // multi-stage item counted once, done item excluded
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
    expect(metrics.wipTotal).toBe(0);
  });

  it('given an item pulled back out of canceled, then it counts as in-flight again', () => {
    const item = makeItem({
      stages: ['triage'],
      stageHistory: [
        { stage: 'canceled', enteredAt: hoursAgo(8), exitedAt: hoursAgo(2), by: 'user_1' },
        { stage: 'triage', enteredAt: hoursAgo(2), by: 'user_1' },
      ],
    });

    expect(computeFactoryMetrics([item], lastDays(7)).wipTotal).toBe(1);
  });

  it('given stage moves in the window, then transitions count entries and split out factory actors', () => {
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(50 * 24), exitedAt: hoursAgo(3), by: 'user_1' }, // entered outside window
        { stage: 'triage', enteredAt: hoursAgo(3), exitedAt: hoursAgo(2), by: 'user_1' },
        { stage: 'execute', enteredAt: hoursAgo(2), by: 'factory' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(30));

    expect(metrics.transitions).toEqual({ human: 1, total: 2 });
  });

  it('given a webhook-created card, then landing on the board is not an automated move', () => {
    const item = makeItem({
      externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
      stages: ['triage'],
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(5), exitedAt: hoursAgo(4), by: 'github:app', exitedBy: 'user_1' },
        { stage: 'triage', enteredAt: hoursAgo(4), by: 'user_1' },
      ],
    });

    const metrics = computeFactoryMetrics([item], lastDays(7));

    expect(metrics.transitions).toEqual({ human: 1, total: 1 });
  });

  it('given governed-transition actor ids, then rules-engine and agent moves count as automated', () => {
    // Actor ids exactly as the transition service stamps them: the dispatcher
    // system id and an agent binding (see actorId in rules/transition-service.ts).
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [
        { stage: 'intake', enteredAt: hoursAgo(10), exitedAt: hoursAgo(9), by: 'user_1', exitedBy: 'user_1' },
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

    expect(metrics.transitions).toEqual({ human: 0, total: 2 });
    expect(metrics.stageAutomation).toEqual([
      { stage: 'intake', exits: 1, automated: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
      { stage: 'triage', exits: 1, automated: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
    ]);
  });

  describe('stageAutomation', () => {
    it('given automation on part of the board, then only the automated stage counts as automated', () => {
      // Triage fully automated; planning entered by automation but approved
      // (exited) by a human — the partial-board case.
      const item = makeItem({
        stages: ['execute'],
        stageHistory: [
          { stage: 'triage', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'factory', exitedBy: 'factory' },
          { stage: 'planning', enteredAt: hoursAgo(8), exitedAt: hoursAgo(2), by: 'factory', exitedBy: 'user_1' },
          { stage: 'execute', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.stageAutomation).toEqual([
        { stage: 'triage', exits: 1, automated: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
        { stage: 'planning', exits: 1, automated: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
      ]);
    });

    it('given a reworked stage, then the redo is reported as an outcome, not as a second denominator', () => {
      // First triage pass fully automated, then the item bounced back through
      // triage, then went done. Reworked deliberately outranks done.
      const item = makeItem({
        stages: ['done'],
        stageHistory: [
          { stage: 'triage', enteredAt: hoursAgo(10), exitedAt: hoursAgo(9), by: 'factory', exitedBy: 'factory' },
          { stage: 'triage', enteredAt: hoursAgo(8), exitedAt: hoursAgo(7), by: 'factory', exitedBy: 'factory' },
          { stage: 'done', enteredAt: hoursAgo(6), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      // One pass, one card: counting the redo as a second exit would report 50%
      // automated for a stage no human ever touched.
      expect(metrics.stageAutomation).toEqual([
        { stage: 'triage', exits: 1, automated: 1, outcomes: { done: 0, canceled: 0, reworked: 1, inFlight: 0 } },
      ]);
    });

    it('given entries missing exitedBy or with a human on either end, then the visit is not automated', () => {
      const items = [
        makeItem({
          id: '00000000-0000-4000-8000-000000000001',
          stages: ['planning'],
          stageHistory: [
            // Legacy entry: automation-entered but closed before exit stamping existed.
            { stage: 'triage', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'factory' },
            { stage: 'planning', enteredAt: hoursAgo(8), by: 'user_1' },
          ],
        }),
        makeItem({
          id: '00000000-0000-4000-8000-000000000002',
          stages: ['planning'],
          stageHistory: [
            // Human-entered, automation-exited: mixed visit is not automated.
            { stage: 'triage', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'user_1', exitedBy: 'factory' },
            { stage: 'planning', enteredAt: hoursAgo(8), by: 'factory' },
          ],
        }),
      ];

      const metrics = computeFactoryMetrics(items, lastDays(7));

      expect(metrics.stageAutomation).toEqual([
        { stage: 'triage', exits: 2, automated: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
      ]);
    });

    it('given automated passes with different endings, then outcomes classify done, canceled, and in flight', () => {
      const autoTriage = (id: string, stages: string[], tail: WorkItemStageEntry[]): WorkItemRow =>
        makeItem({
          id,
          stages,
          stageHistory: [
            { stage: 'triage', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'automation', exitedBy: 'system' },
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

      expect(metrics.stageAutomation).toEqual([
        { stage: 'triage', exits: 3, automated: 3, outcomes: { done: 1, canceled: 1, reworked: 0, inFlight: 1 } },
      ]);
    });

    it('given an item that landed after the window, then the outcome is the one the window saw', () => {
      // Automated triage pass inside the window; the card only reached done
      // afterwards, so re-querying the same window must keep reporting in flight.
      const item = makeItem({
        stages: ['done'],
        stageHistory: [
          { stage: 'triage', enteredAt: hoursAgo(30), exitedAt: hoursAgo(26), by: 'factory', exitedBy: 'factory' },
          { stage: 'done', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], {
        windowStart: NOW.getTime() - 40 * HOUR,
        windowEnd: NOW.getTime() - 20 * HOUR,
      });

      expect(metrics.stageAutomation).toEqual([
        { stage: 'triage', exits: 1, automated: 1, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 1 } },
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
            exitedBy: 'factory',
          },
          { stage: 'planning', enteredAt: hoursAgo(8 * 24), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.stageAutomation).toEqual([]);
    });

    it('given visits to terminal stages, then they never produce rows', () => {
      const item = makeItem({
        stages: ['triage'],
        stageHistory: [
          { stage: 'done', enteredAt: hoursAgo(9), exitedAt: hoursAgo(8), by: 'factory', exitedBy: 'factory' },
          { stage: 'canceled', enteredAt: hoursAgo(8), exitedAt: hoursAgo(2), by: 'factory', exitedBy: 'factory' },
          { stage: 'triage', enteredAt: hoursAgo(2), by: 'user_1' },
        ],
      });

      const metrics = computeFactoryMetrics([item], lastDays(7));

      expect(metrics.stageAutomation).toEqual([]);
    });
  });
});
