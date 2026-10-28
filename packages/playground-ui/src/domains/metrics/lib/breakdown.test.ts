import { describe, expect, it } from 'vitest';
import {
  breakdownGroupBy,
  buildBreakdownRows,
  changeTrend,
  countsSpans,
  entitiesAggregateRequest,
  hasErrors,
  hasUsage,
  previousFigures,
  rowChange,
  spanTypeWhere,
  threadResources,
  threadsAggregateRequest,
  withDropped,
} from './breakdown';
import type { BreakdownRow, BreakdownTab } from './breakdown';

const start = new Date('2026-10-20T00:00:00Z');
const end = new Date('2026-10-20T03:00:00Z');
const timeRange = { from: start.toISOString(), to: end.toISOString() };

describe('buildBreakdownRows', () => {
  describe('when an agent has runs and model usage', () => {
    it('counts the traces it ran in, with its per-run errors and P95, tokens and cost', () => {
      const [row] = buildBreakdownRows({
        tab: 'agents',
        groupBy: ['entityName'],
        aggregateRows: [
          {
            dimensions: { entityName: 'Code Agent' },
            measures: { count: 40, 'countDistinct.traceId': 12, errorRate: 0.05, 'duration.p95': 1800 },
          },
        ],
        usageGroups: [{ dimensions: { entityName: 'Code Agent' }, value: 400, estimatedCost: 2, costUnit: 'USD' }],
      });
      expect(row).toEqual({
        key: 'Code Agent',
        name: 'Code Agent',
        count: 12,
        errorRate: 0.05,
        p95: 1800,
        tokens: 400,
        cost: 2,
        costUnit: 'USD',
      });
    });
  });

  describe('when a tool is called many times in one trace', () => {
    it('counts every call, since tools count spans', () => {
      const [row] = buildBreakdownRows({
        tab: 'tools',
        groupBy: ['entityName'],
        aggregateRows: [{ dimensions: { entityName: 'search' }, measures: { count: 9 } }],
      });
      expect(row?.count).toBe(9);
      expect(row?.tokens).toBeUndefined();
    });
  });

  describe('when a model has usage', () => {
    it('counts its spans from the counted model calls', () => {
      const [row] = buildBreakdownRows({
        tab: 'models',
        groupBy: ['model'],
        usageGroups: [{ dimensions: { model: 'gpt-5-mini' }, value: 900, estimatedCost: 0.3, costUnit: 'USD' }],
        spanGroups: [{ dimensions: { model: 'gpt-5-mini' }, value: 31 }],
      });
      expect(row).toMatchObject({ key: 'gpt-5-mini', count: 31, tokens: 900, cost: 0.3 });
    });
  });

  describe('when a usage group has no price', () => {
    it('reports no cost rather than zero', () => {
      const [row] = buildBreakdownRows({
        tab: 'agents',
        groupBy: ['entityName'],
        aggregateRows: [{ dimensions: { entityName: 'Observer' }, measures: { 'countDistinct.traceId': 3 } }],
        usageGroups: [{ dimensions: { entityName: 'Observer' }, value: 50, estimatedCost: null, costUnit: null }],
      });
      expect(row?.tokens).toBe(50);
      expect(row?.cost).toBeUndefined();
      expect(row?.costUnit).toBeUndefined();
    });
  });

  describe('when the rows group by project and entity', () => {
    it('keys each row by both, as metrics name them, and keeps the project', () => {
      const rows = buildBreakdownRows({
        tab: 'agents',
        groupBy: ['projectId', 'entityName'],
        aggregateRows: [
          { dimensions: { projectId: 'p1', entityName: 'Code Agent' }, measures: { 'countDistinct.traceId': 4 } },
        ],
        usageGroups: [{ dimensions: { projectId: 'p1', entityName: 'Code Agent' }, value: 7 }],
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ key: 'p1|Code Agent', projectId: 'p1', name: 'Code Agent', tokens: 7 });
    });
  });

  describe('when a group spends tokens without traces in the window', () => {
    it('still lists it, so spend is never dropped', () => {
      const rows = buildBreakdownRows({
        tab: 'environments',
        groupBy: ['environment'],
        usageGroups: [{ dimensions: { environment: 'staging' }, value: 12, estimatedCost: 0.1, costUnit: 'USD' }],
      });
      expect(rows).toEqual([expect.objectContaining({ key: 'staging', count: 0, tokens: 12, cost: 0.1 })]);
    });
  });

  describe('when a group has no value', () => {
    it('keys it by an empty name, as metrics do', () => {
      const [row] = buildBreakdownRows({
        tab: 'environments',
        groupBy: ['environment'],
        aggregateRows: [{ dimensions: { environment: null }, measures: { count: 2 } }],
      });
      expect(row).toMatchObject({ key: '', name: '' });
    });
  });

  describe('when threads come with their resources', () => {
    it('names each thread’s resource, and leaves it unset for a thread without one', () => {
      const aggregateRows = [
        { dimensions: { resourceId: 'user-1', threadId: 't1' }, measures: { count: 3 } },
        { dimensions: { resourceId: null, threadId: 't2' }, measures: { count: 1 } },
      ];
      const rows = buildBreakdownRows({
        tab: 'threads',
        groupBy: ['threadId'],
        aggregateRows,
        resources: threadResources(aggregateRows),
      });
      expect(rows).toMatchObject([
        { key: 't1', resource: 'user-1', count: 3 },
        { key: 't2', count: 1 },
      ]);
      expect(rows[1]?.resource).toBeUndefined();
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
  });

  describe('when a tab lists models', () => {
    it('has no errors or P95, since its spans come from metrics', () => {
      expect(tabs.filter(t => !hasErrors(t))).toEqual(['models']);
    });
  });

  describe('when one trace can make many of a tab’s rows', () => {
    it('counts spans for tools and models, traces everywhere else', () => {
      expect(tabs.filter(countsSpans)).toEqual(['tools', 'models']);
    });
  });
});

describe('breakdownGroupBy', () => {
  describe('when the page spans an organization', () => {
    it('groups every tab but Projects by project too', () => {
      expect(breakdownGroupBy('projects', true)).toEqual(['projectId']);
      expect(breakdownGroupBy('threads', true)).toEqual(['projectId', 'threadId']);
      expect(breakdownGroupBy('models', true)).toEqual(['projectId', 'provider', 'model']);
      expect(breakdownGroupBy('environments', true)).toEqual(['projectId', 'environment']);
    });
  });
});

describe('entitiesAggregateRequest', () => {
  describe('when the tab lists agents or workflows', () => {
    it('asks for the distinct traces they ran in', () => {
      expect(entitiesAggregateRequest('agents', { timeRange }, false).measures).toContain('countDistinct.traceId');
    });
  });

  describe('when the tab lists tools', () => {
    it('asks for spans only', () => {
      expect(entitiesAggregateRequest('tools', { timeRange }, false).measures).not.toContain('countDistinct.traceId');
    });
  });
});

describe('threadsAggregateRequest', () => {
  describe('when the page has no filter', () => {
    it('counts only traces that have a thread', () => {
      expect(threadsAggregateRequest({ timeRange, where: undefined }, false).where).toEqual({
        op: 'exists',
        path: 'threadId',
      });
    });
  });

  describe('when the page has a filter', () => {
    it('keeps it', () => {
      const where = { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } } as const;
      expect(threadsAggregateRequest({ timeRange, where }, false).where).toEqual({
        op: 'and',
        args: [{ op: 'exists', path: 'threadId' }, where],
      });
    });
  });

  describe('when the page covers one project', () => {
    it('groups by resource too, so each thread names its resource for free', () => {
      expect(threadsAggregateRequest({ timeRange }, false).groupBy).toEqual(['resourceId', 'threadId']);
    });
  });

  describe('when the page spans an organization', () => {
    it('groups by project, within the two-dimension limit', () => {
      expect(threadsAggregateRequest({ timeRange }, true).groupBy).toEqual(['projectId', 'threadId']);
    });
  });
});

describe('rowChange', () => {
  const row = (figures: Partial<BreakdownRow>): BreakdownRow => ({ key: 'a', name: 'a', count: 0, ...figures });
  const previous = previousFigures({
    tab: 'agents',
    groupBy: ['entityName'],
    aggregateRows: [
      {
        dimensions: { entityName: 'a' },
        measures: { count: 300, 'countDistinct.traceId': 100, errorRate: 0.02, 'duration.p95': 1000 },
      },
    ],
    usageGroups: [{ dimensions: { entityName: 'a' }, value: 10, estimatedCost: 2, costUnit: 'USD' }],
  }).get('a');

  describe('when the row has a previous figure', () => {
    it('gives traces, P95, tokens and cost as a relative change', () => {
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
    it('is new for counts, tokens and cost, and has no change for error rate or P95', () => {
      expect(rowChange(row({ count: 5 }), undefined, 'count').isNew).toBe(true);
      expect(rowChange(row({ cost: 1 }), undefined, 'cost').isNew).toBe(true);
      expect(rowChange(row({ errorRate: 0.1 }), undefined, 'errorRate')).toEqual({ isNew: false });
    });
  });

  describe('when the row has no figure now', () => {
    it('has no change', () => {
      expect(rowChange(row({}), previous, 'cost')).toEqual({ isNew: false });
    });
  });
});

describe('changeTrend', () => {
  describe('when a figure goes up', () => {
    it('is good for counts and bad for errors, P95, tokens and cost', () => {
      const up = { delta: 1, change: 0.1, isNew: false };
      expect(changeTrend(up, 'count')).toBe('good');
      expect(changeTrend(up, 'errorRate')).toBe('bad');
      expect(changeTrend(up, 'cost')).toBe('bad');
    });
  });

  describe('when nothing changed or there is nothing to compare', () => {
    it('is neutral', () => {
      expect(changeTrend({ delta: 0, change: 0, isNew: false }, 'count')).toBeUndefined();
      expect(changeTrend({ isNew: true }, 'count')).toBeUndefined();
    });
  });
});

describe('withDropped', () => {
  const groupBy = ['projectId', 'entityName'];
  const previous = previousFigures({
    tab: 'tools',
    groupBy,
    aggregateRows: [
      { dimensions: { projectId: 'p1', entityName: 'kept' }, measures: { count: 3 } },
      { dimensions: { projectId: 'p2', entityName: 'gone' }, measures: { count: 7 } },
      { dimensions: { projectId: 'p2', entityName: 'idle' }, measures: { count: 0 } },
    ],
  });
  const kept = buildBreakdownRows({
    tab: 'tools',
    groupBy,
    aggregateRows: [{ dimensions: { projectId: 'p1', entityName: 'kept' }, measures: { count: 4 } }],
  });

  describe('when a group ran before but not now', () => {
    it('adds it at zero, with its project and name', () => {
      const rows = withDropped(kept, previous, groupBy, false);
      expect(rows.map(r => r.key)).toEqual(['p1|kept', 'p2|gone']);
      expect(rows[1]).toMatchObject({ projectId: 'p2', name: 'gone', count: 0 });
      expect(rows[1]?.tokens).toBeUndefined();
      expect(rowChange(rows[1], previous.get('p2|gone'), 'count').change).toBe(-1);
    });
  });
});
