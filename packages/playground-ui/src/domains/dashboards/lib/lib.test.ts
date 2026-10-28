import type { DashboardQuery } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import { dashboardDefaults, inScope, targetScope, viewDrilldown } from './definition';
import { buildPreviousRequest, buildRequest } from './requests';
import type { DashboardPageContext } from './requests';
import { buildTableRows, listedRows, previousTableFigures, rowDrilldown, tableIssues } from './table';
import type { TableColumn, TableOptions } from './table';
import { evaluate, matchesGroups, outOfRangeQueries, valueExprSchema } from './values';
import type { ValueRef } from './values';

const window = { start: new Date('2026-10-27T12:00:00Z'), end: new Date('2026-10-28T12:00:00Z') };
const page: DashboardPageContext = {
  window,
  filters: { timestamp: window, environment: 'production' },
  traceWhere: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
};

describe('value expressions', () => {
  const values: Record<number, number | undefined> = { 0: 100, 1: 30, 2: undefined };
  const read = (ref: ValueRef) => values[ref.query];

  it('sums, subtracts down to zero, and divides', () => {
    expect(evaluate({ sum: [{ query: 0 }, { query: 1 }] }, read)).toBe(130);
    expect(evaluate({ minus: [{ query: 1 }, { query: 0 }] }, read)).toBe(0);
    expect(evaluate({ ratio: { of: { query: 1 }, over: { query: 0 } } }, read)).toBe(0.3);
  });

  it('is missing only when everything it reads is missing', () => {
    expect(evaluate({ query: 2 }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 2 }, { query: 2 }] }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 2 }, { query: 1 }] }, read)).toBe(30);
  });

  it('reads a ratio over nothing as zero', () => {
    expect(evaluate({ ratio: { of: { query: 1 }, over: { query: 2 } } }, read)).toBe(0);
  });

  it('matches series names case-insensitively', () => {
    const failed = { query: 0, groupsIncluding: ['error', 'fail'] };
    const completed = { query: 0, groupsExcluding: ['error', 'fail'] };
    expect(matchesGroups(failed, 'FAILED')).toBe(true);
    expect(matchesGroups(completed, 'success')).toBe(true);
    expect(matchesGroups(completed, 'error')).toBe(false);
  });

  it('parses nested expressions and rejects unknown keys', () => {
    expect(valueExprSchema.safeParse({ sum: [{ minus: [{ query: 0 }, { query: 1 }] }] }).success).toBe(true);
    expect(valueExprSchema.safeParse({ product: [{ query: 0 }] }).success).toBe(false);
    expect(outOfRangeQueries([{ sum: [{ query: 0 }, { query: 3 }] }], 2)).toEqual([{ query: 3 }]);
  });
});

describe('buildRequest', () => {
  it('ANDs the widget predicate before the page one, and sets the time range', () => {
    const query: DashboardQuery = {
      source: 'traceAggregate',
      where: { op: 'exists', path: 'threadId' },
      groupBy: ['threadId'],
      measures: ['count'],
    };
    const request = buildRequest(query, page, {});
    expect(request.method).toBe('aggregateTraces');
    expect(request.args).toMatchObject({
      where: { op: 'and', args: [{ op: 'exists', path: 'threadId' }, page.traceWhere] },
      timeRange: { from: window.start.toISOString(), to: window.end.toISOString() },
    });
  });

  it('merges metrics filters, the widget winning, and compares an aggregate in the same request', () => {
    const query: DashboardQuery = {
      source: 'metrics',
      request: 'aggregate',
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
      filters: { environment: 'staging' },
      compare: 'previousWindow',
    };
    expect(buildRequest(query, page, {}).args).toEqual({
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
      filters: { environment: 'staging', timestamp: window },
      comparePeriod: 'previous_period',
    });
    expect(buildPreviousRequest(query, page, {})).toBeUndefined();
  });

  it('sends anything else over the previous window as a request of its own, last', () => {
    const query: DashboardQuery = {
      source: 'metrics',
      request: 'timeSeries',
      name: ['mastra_model_total_input_tokens'],
      aggregation: 'sum',
      compare: 'previousWindow',
    };
    const previous = buildPreviousRequest(query, page, { interval: '1h' });
    expect(previous?.args).toMatchObject({
      interval: '1h',
      filters: { timestamp: { start: new Date('2026-10-26T12:00:00Z'), end: window.start } },
    });
    expect(previous?.priority).toBeUndefined();
  });

  it('sends a previous-window aggregate after everything else', () => {
    const query: DashboardQuery = { source: 'spanAggregate', measures: ['count'], compare: 'previousWindow' };
    const previous = buildPreviousRequest(query, page, {});
    expect(previous?.priority).toBe(2);
    expect(previous?.args).toMatchObject({ timeRange: { to: window.start.toISOString() } });
  });
});

describe('definition helpers', () => {
  it('hides what belongs to the other scope', () => {
    expect(inScope({}, 'org')).toBe(true);
    expect(inScope({ scope: 'org' }, 'project')).toBe(false);
  });

  it("lets a view's drilldown targets override the widget's", () => {
    const drilldown = viewDrilldown(
      {
        id: 'w',
        span: 6,
        kind: 'timeseries',
        views: [],
        drilldown: { action: { page: 'traces' }, click: { page: 'traces' } },
      },
      { queries: [], drilldown: { action: { page: 'logs' } } },
    );
    expect(drilldown).toEqual({ action: { page: 'logs' }, click: { page: 'traces' } });
  });

  it('turns single-value chips on scope fields into a drilldown scope', () => {
    expect(
      targetScope({
        page: 'logs',
        filters: [
          { fieldId: 'status', value: 'error' },
          { fieldId: 'tags', value: ['a'] },
          { id: 'g', logic: 'or', nodes: [] },
        ],
      }),
    ).toEqual({ status: 'error' });
  });

  it('reads defaults as a preset and top-level chips', () => {
    expect(
      dashboardDefaults({
        defaults: {
          datePreset: '7d',
          filters: [
            { fieldId: 'environment', value: 'production', operatorId: 'is' },
            { id: 'g', logic: 'and', nodes: [] },
          ],
        },
      }),
    ).toEqual({ preset: '7d', filterTokens: [{ fieldId: 'environment', value: 'production' }] });
    expect(dashboardDefaults({ defaults: { datePreset: 'yesterday' } })).toEqual({ filterTokens: [] });
  });
});

describe('table rows', () => {
  const options: TableOptions = { groupBy: ['projectId', 'entityName'], emptyMessage: 'None.' };
  const columns: TableColumn[] = [
    { id: 'project', options: {} },
    { id: 'errorRate', options: { query: 0, measure: 'errorRate' } },
    { id: 'p95', options: { query: 0, measure: 'duration.p95' } },
    { id: 'tokens', options: { query: 1, field: 'value' } },
    { id: 'cost', options: { query: 1, field: 'estimatedCost' } },
    { id: 'count', options: { query: 0, measure: 'countDistinct.traceId' } },
  ];
  const aggregate = {
    rows: [
      {
        dimensions: { projectId: 'p1', entityName: 'Code Agent' },
        measures: { 'countDistinct.traceId': 4, errorRate: 0.25, 'duration.p95': 900 },
      },
    ],
  };
  const usage = {
    groups: [
      { dimensions: { projectId: 'p1', entityName: 'Code Agent' }, value: 1200, estimatedCost: 0.5, costUnit: 'usd' },
      { dimensions: { projectId: 'p2', entityName: 'Idle Agent' }, value: 50, estimatedCost: null, costUnit: null },
    ],
  };

  it('joins every query on groupBy, keeping a group that only has usage', () => {
    expect(buildTableRows(options, columns, [aggregate, usage])).toEqual([
      {
        key: 'p1|Code Agent',
        projectId: 'p1',
        name: 'Code Agent',
        count: 4,
        tokens: 1200,
        errorRate: 0.25,
        p95: 900,
        cost: 0.5,
        costUnit: 'usd',
      },
      {
        key: 'p2|Idle Agent',
        projectId: 'p2',
        name: 'Idle Agent',
        count: 0,
        tokens: 50,
        cost: undefined,
        costUnit: undefined,
      },
    ]);
  });

  it('names resources through a lookup query', () => {
    const threads: TableOptions = { groupBy: ['threadId'], emptyMessage: 'None.' };
    const rows = buildTableRows(
      threads,
      [
        { id: 'count', options: { query: 0, measure: 'count' } },
        { id: 'resource', options: { query: 1, dimension: 'resourceId', joinOn: 'threadId' } },
      ],
      [
        { rows: [{ dimensions: { threadId: 't1' }, measures: { count: 3 } }] },
        { rows: [{ dimensions: { resourceId: 'user-1', threadId: 't1' }, measures: { count: 3 } }] },
      ],
    );
    expect(rows[0]?.resource).toBe('user-1');
  });

  it('adds dropped groups unless the view turns them off or the list is cut short', () => {
    const previous = previousTableFigures(options, columns, [
      { rows: [{ dimensions: { projectId: 'p1', entityName: 'Retired' }, measures: { 'countDistinct.traceId': 2 } }] },
      { groups: [] },
    ]);
    const built = buildTableRows(options, columns, [aggregate, { groups: [] }]);
    expect(listedRows(options, built, previous, false, true).map(r => r.name)).toEqual(['Code Agent', 'Retired']);
    expect(listedRows(options, built, previous, true, true)).toHaveLength(1);
    expect(listedRows({ ...options, dropped: false }, built, previous, false, true)).toHaveLength(1);
  });

  it('drills into a row by its project and its spans or name', () => {
    const row = { key: 'p1|Code Agent', projectId: 'p1', name: 'Code Agent', count: 1 };
    expect(rowDrilldown({ ...options, rowScope: { spanTypes: ['agent_run'] } }, row)).toEqual({
      projectId: 'p1',
      span: { spanTypes: ['agent_run'], entityName: 'Code Agent' },
    });
    expect(rowDrilldown({ ...options, rowScope: { field: 'model' } }, { ...row, name: '' })).toEqual({
      projectId: 'p1',
    });
  });

  it('reports columns the view cannot fill', () => {
    expect(
      tableIssues(
        [
          { id: 'errorRate', options: { query: 0, measure: 'errorRate' } },
          { id: 'sparkline', options: {} },
          { id: 'tokens', options: { query: 4, field: 'value' } },
        ],
        [{ source: 'traceAggregate', measures: ['count'] }],
      ),
    ).toEqual([
      "columns.1: unknown column 'sparkline'",
      "columns: a table needs a 'count' column",
      "columns: 'errorRate' and 'p95' come together",
      "columns: 'tokens' and 'cost' come together",
      "columns: 'tokens' reads query 4, which the view doesn't have",
    ]);
  });
});
