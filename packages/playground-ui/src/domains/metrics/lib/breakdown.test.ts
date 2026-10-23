import { describe, expect, it } from 'vitest';
import { buildBreakdownRows, hasUsage, spanTypeWhere } from './breakdown';
import type { BreakdownTab } from './breakdown';
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

describe('hasUsage', () => {
  describe('when model usage can be attributed to the tab’s rows', () => {
    it('is true for projects, agents and environments only', () => {
      const tabs: BreakdownTab[] = ['projects', 'agents', 'workflows', 'tools', 'environments'];
      expect(tabs.filter(hasUsage)).toEqual(['projects', 'agents', 'environments']);
    });
  });
});
