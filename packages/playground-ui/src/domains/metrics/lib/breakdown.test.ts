import { describe, expect, it } from 'vitest';
import {
  buildBreakdownRows,
  changeTrend,
  hasRuns,
  hasTrend,
  hasUsage,
  previousFigures,
  rowChange,
  spanTypeWhere,
  threadsAggregateRequest,
  withDropped,
} from './breakdown';
import type { BreakdownRow, BreakdownTab } from './breakdown';
import { bucketGrid } from './metrics-buckets';

const start = new Date('2026-10-20T00:00:00Z');
const end = new Date('2026-10-20T03:00:00Z');
const grid = { buckets: bucketGrid(start, end, 1), stepHours: 1 };
const at = (hour: number) => new Date(start.getTime() + hour * 3_600_000);

describe('buildBreakdownRows', () => {
  describe('when an entity has runs and model usage', () => {
    it('merges its runs, errors and P95 with its tokens, cost and trend', () => {
      const [row] = buildBreakdownRows(
        [{ dimensions: { entityName: 'Code Agent' }, measures: { count: 40, errorRate: 0.05, 'duration.p95': 1800 } }],
        ['entityName'],
        [
          {
            name: 'Code Agent',
            costUnit: 'USD',
            points: [
              { timestamp: at(0), value: 100, estimatedCost: 0.5 },
              { timestamp: at(2), value: 300, estimatedCost: 1.5 },
            ],
          },
        ],
        grid,
      );
      expect(row).toMatchObject({
        key: 'Code Agent',
        name: 'Code Agent',
        count: 40,
        errorRate: 0.05,
        p95: 1800,
        tokens: 400,
        cost: 2,
        costUnit: 'USD',
      });
      expect(row?.trend.slice(0, 3)).toEqual([100, 0, 300]);
    });
  });

  describe('when an entity has runs but no priced usage', () => {
    it('reports no cost rather than zero', () => {
      const [row] = buildBreakdownRows(
        [{ dimensions: { entityName: 'Observer' }, measures: { count: 3 } }],
        ['entityName'],
        [{ name: 'Observer', points: [{ timestamp: at(1), value: 50 }] }],
        grid,
      );
      expect(row).toMatchObject({ tokens: 50, cost: null, costUnit: null });
    });
  });

  describe('when the tab sends no token series', () => {
    it('leaves tokens unknown', () => {
      const [row] = buildBreakdownRows(
        [{ dimensions: { entityName: 'search' }, measures: { count: 9 } }],
        ['entityName'],
        undefined,
        grid,
      );
      expect(row?.tokens).toBeNull();
    });
  });

  describe('when the rows group by project and entity', () => {
    it('keys each row by both, as metric series name them, and keeps the project', () => {
      const rows = buildBreakdownRows(
        [{ dimensions: { projectId: 'p1', entityName: 'Code Agent' }, measures: { count: 4 } }],
        ['projectId', 'entityName'],
        [{ name: 'p1|Code Agent', points: [{ timestamp: at(0), value: 7 }] }],
        grid,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ key: 'p1|Code Agent', projectId: 'p1', name: 'Code Agent', tokens: 7 });
    });
  });

  describe('when a group spends tokens without runs in the window', () => {
    it('still lists it, so spend is never dropped', () => {
      const rows = buildBreakdownRows(
        [],
        ['environment'],
        [{ name: 'staging', points: [{ timestamp: at(0), value: 12, estimatedCost: 0.1 }] }],
        grid,
      );
      expect(rows).toEqual([expect.objectContaining({ key: 'staging', count: 0, tokens: 12, cost: 0.1 })]);
    });
  });

  describe('when a group has no value', () => {
    it('keys it by an empty name, as metric series do', () => {
      const [row] = buildBreakdownRows(
        [{ dimensions: { environment: null }, measures: { count: 2 } }],
        ['environment'],
        undefined,
        grid,
      );
      expect(row).toMatchObject({ key: '', name: '' });
    });
  });
});

describe('spanTypeWhere', () => {
  describe('when a tab counts one span type', () => {
    it('matches it exactly', () => {
      expect(spanTypeWhere('agents')).toEqual({
        op: 'eq',
        left: { path: 'spanType' },
        right: { literal: 'agent_run' },
      });
    });
  });

  describe('when a tab counts several span types', () => {
    it('matches any of them', () => {
      expect(spanTypeWhere('tools')).toEqual({
        op: 'in',
        value: { path: 'spanType' },
        set: ['tool_call', 'mcp_tool_call'],
      });
    });
  });
});

describe('tab columns', () => {
  const tabs: BreakdownTab[] = ['projects', 'agents', 'workflows', 'tools', 'models', 'threads', 'environments'];

  describe('when model usage can be attributed to the tab’s rows', () => {
    it('has tokens and cost on every tab but workflows and tools', () => {
      expect(tabs.filter(hasUsage)).toEqual(['projects', 'agents', 'models', 'threads', 'environments']);
    });

    it('has a trend only where a series per row is affordable', () => {
      expect(tabs.filter(hasTrend)).toEqual(['projects', 'agents', 'environments']);
    });
  });

  describe('when a tab lists models', () => {
    it('has no runs, since a run is not tied to one model', () => {
      expect(tabs.filter(t => !hasRuns(t))).toEqual(['models']);
    });
  });
});

describe('threadsAggregateRequest', () => {
  const timeRange = { from: start.toISOString(), to: end.toISOString() };

  describe('when the page has no filter', () => {
    it('counts only traces that have a thread', () => {
      expect(threadsAggregateRequest({ timeRange, where: undefined }).where).toEqual({
        op: 'exists',
        path: 'threadId',
      });
    });
  });

  describe('when the page has a filter', () => {
    it('keeps it', () => {
      const where = { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } } as const;
      expect(threadsAggregateRequest({ timeRange, where }).where).toEqual({
        op: 'and',
        args: [{ op: 'exists', path: 'threadId' }, where],
      });
    });
  });
});

describe('buildBreakdownRows with usage totals', () => {
  describe('when a tab takes tokens and cost from a metrics breakdown', () => {
    it('sets them on the matching rows and lists usage-only groups', () => {
      const rows = buildBreakdownRows(
        [{ dimensions: { threadId: 't1' }, measures: { count: 3 } }],
        ['threadId'],
        undefined,
        grid,
        [
          { dimensions: { threadId: 't1' }, value: 900, estimatedCost: 0.3, costUnit: 'USD' },
          { dimensions: { threadId: 't2' }, value: 50, estimatedCost: null, costUnit: null },
        ],
      );
      expect(rows).toMatchObject([
        { key: 't1', count: 3, tokens: 900, cost: 0.3, costUnit: 'USD' },
        { key: 't2', count: 0, tokens: 50, cost: null },
      ]);
    });
  });
});

describe('rowChange', () => {
  const row = (figures: Partial<BreakdownRow>): BreakdownRow => ({
    key: 'a',
    name: 'a',
    count: 0,
    errorRate: null,
    p95: null,
    resources: null,
    threads: null,
    tokens: null,
    cost: null,
    costUnit: null,
    trend: [],
    ...figures,
  });
  const previous = previousFigures(
    [{ dimensions: { entityName: 'a' }, measures: { count: 100, errorRate: 0.02, 'duration.p95': 1000 } }],
    ['entityName'],
    [{ dimensions: { entityName: 'a' }, value: 10, estimatedCost: 2, costUnit: 'USD' }],
  ).get('a');

  describe('when the row has a previous figure', () => {
    it('gives runs, P95, tokens and cost as a relative change', () => {
      expect(rowChange(row({ count: 150 }), previous, 'count')).toEqual({ delta: 50, change: 0.5, isNew: false });
      expect(rowChange(row({ p95: 500 }), previous, 'p95').change).toBe(-0.5);
      expect(rowChange(row({ tokens: 30 }), previous, 'tokens').change).toBe(2);
      expect(rowChange(row({ cost: 1 }), previous, 'cost').change).toBe(-0.5);
    });

    it('gives error rate as a difference in points', () => {
      expect(rowChange(row({ errorRate: 0.07 }), previous, 'errorRate').change).toBeCloseTo(0.05);
    });
  });

  describe('when the row had nothing in the previous window', () => {
    it('is new for runs, tokens and cost, and has no change for error rate or P95', () => {
      expect(rowChange(row({ count: 5 }), undefined, 'count').isNew).toBe(true);
      expect(rowChange(row({ cost: 1 }), undefined, 'cost').isNew).toBe(true);
      expect(rowChange(row({ errorRate: 0.1 }), undefined, 'errorRate')).toEqual({
        delta: null,
        change: null,
        isNew: false,
      });
    });
  });

  describe('when the row has no figure now', () => {
    it('has no change', () => {
      expect(rowChange(row({ cost: null }), previous, 'cost')).toEqual({ delta: null, change: null, isNew: false });
    });
  });
});

describe('changeTrend', () => {
  describe('when a figure goes up', () => {
    it('is good for runs and bad for errors, P95, tokens and cost', () => {
      const up = { delta: 1, change: 0.1, isNew: false };
      expect(changeTrend(up, 'count')).toBe('good');
      expect(changeTrend(up, 'errorRate')).toBe('bad');
      expect(changeTrend(up, 'cost')).toBe('bad');
    });
  });

  describe('when nothing changed or there is nothing to compare', () => {
    it('is neutral', () => {
      expect(changeTrend({ delta: 0, change: 0, isNew: false }, 'count')).toBeNull();
      expect(changeTrend({ delta: null, change: null, isNew: true }, 'count')).toBeNull();
    });
  });
});

describe('withDropped', () => {
  const previous = previousFigures(
    [
      { dimensions: { projectId: 'p1', entityName: 'kept' }, measures: { count: 3 } },
      { dimensions: { projectId: 'p2', entityName: 'gone' }, measures: { count: 7 } },
      { dimensions: { projectId: 'p2', entityName: 'idle' }, measures: { count: 0 } },
    ],
    ['projectId', 'entityName'],
    [],
  );
  const kept = buildBreakdownRows(
    [{ dimensions: { projectId: 'p1', entityName: 'kept' }, measures: { count: 4 } }],
    ['projectId', 'entityName'],
    undefined,
    grid,
  );

  describe('when a group ran before but not now', () => {
    it('adds it at zero, with its project and name', () => {
      const rows = withDropped(kept, previous, ['projectId', 'entityName'], false);
      expect(rows.map(r => r.key)).toEqual(['p1|kept', 'p2|gone']);
      expect(rows[1]).toMatchObject({ projectId: 'p2', name: 'gone', count: 0, tokens: null });
      expect(rowChange(rows[1], previous.get('p2|gone'), 'count').change).toBe(-1);
    });
  });
});
