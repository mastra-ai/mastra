import type { TraceAggregateDiscovery } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import type { TraceGroupByDimension, TraceGroupRow, TraceGrouping } from '../trace-group-by';
import {
  applyTraceGroupDrillDown,
  buildTraceGroupByRequest,
  buildTraceGroupEntityIdFallbackRequest,
  DEFAULT_TRACE_GROUP_SORT,
  formatTraceGroupMeasure,
  formatTraceGroupValue,
  getOfferedTraceGroupByDimensions,
  getTraceGroupDrillDown,
  getTraceGroupValue,
  mergeTraceGroupEntityIdFallback,
  parseTraceGroupBy,
  parseTraceGroupHaving,
  parseTraceGroupSort,
  serializeTraceGroupSort,
  supportsTraceGroupEntityIdFallback,
  writeTraceGrouping,
} from '../trace-group-by';
import { buildTraceQueryRequest } from '../trace-query-filters';

const discovery = (paths: string[]): TraceAggregateDiscovery => ({
  dimensions: paths.map(path => ({ path, valueKind: 'string' })),
  measures: [],
});

const row = (measures: TraceGroupRow['measures'], cost?: TraceGroupRow['cost']): TraceGroupRow => ({
  dimensions: { entityName: 'support-agent' },
  measures,
  ...(cost ? { cost } : {}),
});

describe('getOfferedTraceGroupByDimensions', () => {
  it('offers the allowlist when the server does not report dimensions', () => {
    expect(getOfferedTraceGroupByDimensions({})).toEqual(['entityName', 'status', 'environment', 'entityType']);
  });

  it('never offers an extra dimension the server has not reported', () => {
    expect(getOfferedTraceGroupByDimensions({ extraDimensions: ['projectId'] })).not.toContain('projectId');
  });

  it('narrows the allowlist and extras to the reported dimensions', () => {
    expect(
      getOfferedTraceGroupByDimensions({
        discovery: discovery(['status', 'entityName', 'serviceName', 'projectId']),
        extraDimensions: ['projectId'],
      }),
    ).toEqual(['entityName', 'status', 'projectId']);
  });

  it('does not offer a reported extra dimension the page did not ask for', () => {
    expect(getOfferedTraceGroupByDimensions({ discovery: discovery(['entityName', 'projectId']) })).toEqual([
      'entityName',
    ]);
  });
});

const grouped = (dimensions: TraceGroupRow['dimensions']): TraceGroupRow => ({ dimensions, measures: { count: 1 } });

describe('URL state', () => {
  it('reads offered dimensions in order, without repeats, at most two', () => {
    const offered = ['entityName', 'status', 'environment'] as const;
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=status'), offered)).toEqual(['status']);
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=environment,entityName'), offered)).toEqual([
      'environment',
      'entityName',
    ]);
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=status,status,projectId,entityName'), offered)).toEqual([
      'status',
      'entityName',
    ]);
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=status,entityName,environment'), offered)).toEqual([
      'status',
      'entityName',
    ]);
    expect(parseTraceGroupBy(new URLSearchParams(), offered)).toEqual([]);
  });

  it('reads group filters and drops malformed or repeated ones', () => {
    const params = new URLSearchParams({
      groupHaving:
        'errorRate:gt:0.25,count:gte:10,count:lt:3,bogus:gt:1,cost.sum:eq:1,duration.p95:lt:,tokens.input.sum:lt:abc',
    });
    expect(parseTraceGroupHaving(params)).toEqual([
      { measure: 'errorRate', operatorId: 'gt', value: 0.25 },
      { measure: 'count', operatorId: 'gte', value: 10 },
    ]);
  });

  it('round-trips the grouping, and drops group filters once nothing is grouped', () => {
    const params = new URLSearchParams('datePreset=last-24h');
    const grouping: TraceGrouping = {
      groupBy: ['entityName', 'environment'],
      having: [{ measure: 'errorRate', operatorId: 'gt', value: 0.25 }],
    };
    writeTraceGrouping(params, grouping);
    expect(parseTraceGroupBy(params, ['entityName', 'environment'])).toEqual(grouping.groupBy);
    expect(parseTraceGroupHaving(params)).toEqual(grouping.having);

    writeTraceGrouping(params, { groupBy: [], having: grouping.having });
    expect(params.toString()).toBe('datePreset=last-24h');
  });

  it('round-trips a sort and falls back to Traces descending for anything malformed', () => {
    const sort = { measure: 'duration.p95', direction: 'asc' } as const;
    expect(parseTraceGroupSort(new URLSearchParams({ groupSort: serializeTraceGroupSort(sort) }))).toEqual(sort);
    for (const raw of ['', 'duration.p95', 'bogus:desc', 'count:sideways']) {
      expect(parseTraceGroupSort(new URLSearchParams({ groupSort: raw }))).toEqual(DEFAULT_TRACE_GROUP_SORT);
    }
  });
});

describe('buildTraceGroupByRequest', () => {
  const query = buildTraceQueryRequest({
    status: 'error',
    tokens: [{ fieldId: 'environment', value: 'production' }],
    now: new Date('2026-10-15T12:00:00.000Z'),
  });

  it('groups the same selection as the trace list', () => {
    expect(
      buildTraceGroupByRequest(
        query,
        { groupBy: ['entityName'], having: [] },
        { measure: 'cost.sum', direction: 'desc' },
      ),
    ).toEqual({
      timeRange: query.timeRange,
      where: query.where,
      groupBy: ['entityName'],
      measures: [
        'count',
        'errorRate',
        'duration.p50',
        'duration.p95',
        'tokens.input.sum',
        'tokens.output.sum',
        'cost.sum',
      ],
      orderBy: { field: 'cost.sum', direction: 'desc' },
      limit: 50,
    });
  });

  it('groups by two dimensions in order', () => {
    const request = buildTraceGroupByRequest(
      query,
      { groupBy: ['entityName', 'environment'], having: [] },
      DEFAULT_TRACE_GROUP_SORT,
    );
    expect(request.groupBy).toEqual(['entityName', 'environment']);
  });

  it('sends one group filter as a comparison and several joined with and', () => {
    const errorRate = { measure: 'errorRate', operatorId: 'gt', value: 0.25 } as const;
    const count = { measure: 'count', operatorId: 'gte', value: 10 } as const;
    const one = buildTraceGroupByRequest(query, { groupBy: ['status'], having: [errorRate] }, DEFAULT_TRACE_GROUP_SORT);
    expect(one.having).toEqual({ op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } });

    const two = buildTraceGroupByRequest(
      query,
      { groupBy: ['status'], having: [errorRate, count] },
      DEFAULT_TRACE_GROUP_SORT,
    );
    expect(two.having).toEqual({
      op: 'and',
      args: [
        { op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } },
        { op: 'gte', left: { path: 'count' }, right: { literal: 10 } },
      ],
    });
  });

  it('omits where and having when there is nothing to filter', () => {
    const unfiltered = buildTraceQueryRequest({ tokens: [], now: new Date('2026-10-15T12:00:00.000Z') });
    const request = buildTraceGroupByRequest(unfiltered, { groupBy: ['status'], having: [] }, DEFAULT_TRACE_GROUP_SORT);
    expect(request).not.toHaveProperty('where');
    expect(request).not.toHaveProperty('having');
  });
});

describe('formatTraceGroupValue', () => {
  it('labels status, entity types and missing values', () => {
    expect(formatTraceGroupValue('status', 'error')).toBe('Error');
    expect(formatTraceGroupValue('status', 'success')).toBe('Success');
    expect(formatTraceGroupValue('entityType', 'workflow_run')).toBe('Workflow');
    expect(formatTraceGroupValue('entityType', 'tool')).toBe('tool');
    expect(formatTraceGroupValue('environment', undefined)).toBe('(not set)');
    expect(formatTraceGroupValue('entityName', 'support-agent')).toBe('support-agent');
  });

  it('treats a null or empty dimension from the server as not set', () => {
    expect(getTraceGroupValue(grouped({ environment: null }), 'environment')).toBeUndefined();
    expect(getTraceGroupValue(grouped({ environment: '' }), 'environment')).toBeUndefined();
    expect(getTraceGroupValue(grouped({}), 'environment')).toBeUndefined();
  });
});

describe('drill-down', () => {
  const filterFor = (dimension: TraceGroupByDimension, value: string | null) =>
    getTraceGroupDrillDown([dimension], grouped({ [dimension]: value }));

  it('maps each dimension to the trace list filter that selects the group', () => {
    expect(filterFor('entityName', 'support-agent')).toEqual({
      filters: [{ param: 'filterEntityName', value: 'support-agent', operatorId: 'is' }],
    });
    expect(filterFor('status', 'error')).toEqual({ filters: [{ param: 'status', value: 'error', operatorId: 'is' }] });
    expect(filterFor('entityType', 'agent')).toEqual({
      filters: [{ param: 'rootEntityType', value: 'agent', operatorId: 'is' }],
    });
    expect(filterFor('environment', 'production')).toEqual({
      filters: [{ param: 'filterEnvironment', value: 'production', operatorId: 'is' }],
    });
    expect(filterFor('projectId', 'project-a')).toEqual({ filters: [], projectId: 'project-a' });
  });

  it('selects traces without an environment with notExists', () => {
    expect(filterFor('environment', null)).toEqual({
      filters: [{ param: 'filterEnvironment', value: '', operatorId: 'notExists' }],
    });
  });

  it('has no drill-down for groups the filters cannot express', () => {
    expect(filterFor('entityName', null)).toBeUndefined();
    expect(filterFor('entityType', 'tool')).toBeUndefined();
    expect(filterFor('entityType', null)).toBeUndefined();
    expect(filterFor('status', null)).toBeUndefined();
    expect(filterFor('projectId', null)).toBeUndefined();
  });

  it('combines the filters of both dimensions, and has none when either value is inexpressible', () => {
    expect(
      getTraceGroupDrillDown(
        ['entityName', 'environment'],
        grouped({ entityName: 'support-agent', environment: 'production' }),
      ),
    ).toEqual({
      filters: [
        { param: 'filterEntityName', value: 'support-agent', operatorId: 'is' },
        { param: 'filterEnvironment', value: 'production', operatorId: 'is' },
      ],
    });
    expect(
      getTraceGroupDrillDown(['entityName', 'environment'], grouped({ entityName: null, environment: 'production' })),
    ).toBeUndefined();
  });

  it('replaces the existing filters on those fields, keeps the rest and leaves the grouped view', () => {
    const params = new URLSearchParams(
      'groupBy=environment,status&groupHaving=count:gt:1&groupSort=cost.sum:desc&datePreset=last-24h&filterEnvironment=staging&filterEnvironment.op=isNot&filterEntityName=support-agent',
    );
    const drillDown = getTraceGroupDrillDown(
      ['environment', 'status'],
      grouped({ environment: 'production', status: 'error' }),
    );

    const next = applyTraceGroupDrillDown(params, drillDown?.filters ?? []);

    expect(next.has('groupBy')).toBe(false);
    expect(next.has('groupHaving')).toBe(false);
    expect(next.get('groupSort')).toBe('cost.sum:desc');
    expect(next.get('datePreset')).toBe('last-24h');
    expect(next.getAll('filterEnvironment')).toEqual(['production']);
    expect(next.has('filterEnvironment.op')).toBe(false);
    expect(next.get('status')).toBe('error');
    expect(next.get('filterEntityName')).toBe('support-agent');
  });

  it('writes the notExists operator for a not-set environment', () => {
    const drillDown = filterFor('environment', null);

    const next = applyTraceGroupDrillDown(new URLSearchParams('groupBy=environment'), drillDown?.filters ?? []);

    expect(next.get('filterEnvironment')).toBe('');
    expect(next.get('filterEnvironment.op')).toBe('notExists');
  });
});

describe('formatTraceGroupMeasure', () => {
  it('formats counts, rates, durations and tokens', () => {
    const measures = {
      count: 1234,
      errorRate: 0.25,
      'duration.p50': 850,
      'duration.p95': 2400,
      'tokens.input.sum': 15200,
      'tokens.output.sum': 0,
    };
    expect(formatTraceGroupMeasure(row(measures), 'count').text).toBe('1,234');
    expect(formatTraceGroupMeasure(row(measures), 'errorRate').text).toBe('25%');
    expect(formatTraceGroupMeasure(row(measures), 'duration.p50').text).toBe('850ms');
    expect(formatTraceGroupMeasure(row(measures), 'duration.p95').text).toBe('2.4s');
    expect(formatTraceGroupMeasure(row(measures), 'tokens.input.sum').text).toBe('15.2K');
    expect(formatTraceGroupMeasure(row(measures), 'tokens.output.sum').text).toBe('0');
  });

  it('explains missing tokens', () => {
    expect(formatTraceGroupMeasure(row({ 'tokens.input.sum': null }), 'tokens.input.sum')).toEqual({
      text: '—',
      tooltip: 'No token usage recorded for these traces',
    });
  });

  it('shows a fully priced cost as is', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': 1.234 }, { coverage: 1, unit: 'USD' }), 'cost.sum')).toEqual({
      text: '$1.23',
    });
  });

  it('marks partially priced cost as approximate', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': 1.234 }, { coverage: 0.62, unit: 'USD' }), 'cost.sum')).toEqual({
      text: '~$1.23',
      tooltip: 'Priced for 62% of traces with usage',
    });
  });

  it('explains missing and mixed-currency cost', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': null }, { coverage: null, unit: null }), 'cost.sum')).toEqual({
      text: '—',
      tooltip: 'No priced usage for these traces',
    });
    expect(formatTraceGroupMeasure(row({ 'cost.sum': null }, { coverage: 1, unit: 'mixed' }), 'cost.sum')).toEqual({
      text: '—',
      tooltip: 'Costs use more than one currency',
    });
  });
});

describe('entityId fallback', () => {
  const timeRange = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-02T00:00:00Z') };
  const environmentFilter = { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } } as const;
  const request = buildTraceGroupByRequest(
    { timeRange, where: environmentFilter },
    { groupBy: ['entityName', 'status'], having: [] },
    DEFAULT_TRACE_GROUP_SORT,
  );
  const group = (
    dimensions: Record<string, string | null>,
    count: number,
    cost: number | null = null,
  ): TraceGroupRow => ({
    dimensions,
    measures: { count, 'cost.sum': cost },
  });

  describe('when the server reports an entityId dimension', () => {
    it('enables the fallback', () => {
      expect(supportsTraceGroupEntityIdFallback(discovery(['entityName', 'entityId']))).toBe(true);
      expect(supportsTraceGroupEntityIdFallback(discovery(['entityName']))).toBe(false);
      expect(supportsTraceGroupEntityIdFallback(undefined)).toBe(false);
    });
  });

  describe('when the grouped response has a group with no entityName', () => {
    const response = {
      rows: [
        group({ entityName: 'Code Agent', status: 'success' }, 5),
        group({ entityName: null, status: 'success' }, 4),
      ],
      truncated: false,
    };

    it('regroups only the unnamed traces by entityId, keeping the other dimensions and filters', () => {
      expect(buildTraceGroupEntityIdFallbackRequest(request, response)).toEqual({
        ...request,
        where: { op: 'and', args: [environmentFilter, { op: 'notExists', path: 'entityName' }] },
        groupBy: ['entityId', 'status'],
      });
    });

    it('filters on the unnamed traces alone when the list has no filters', () => {
      const unfiltered = { ...request, where: undefined };
      expect(buildTraceGroupEntityIdFallbackRequest(unfiltered, response)?.where).toEqual({
        op: 'notExists',
        path: 'entityName',
      });
    });
  });

  describe('when every group has an entityName, or grouping is not by entityName', () => {
    it('sends no follow-up request', () => {
      const named = { rows: [group({ entityName: 'Code Agent', status: 'success' }, 5)], truncated: false };
      expect(buildTraceGroupEntityIdFallbackRequest(request, named)).toBeUndefined();
      const byStatus = { ...request, groupBy: ['status'] };
      const unnamed = { rows: [group({ status: 'success' }, 5)], truncated: false };
      expect(buildTraceGroupEntityIdFallbackRequest(byStatus, unnamed)).toBeUndefined();
      expect(buildTraceGroupEntityIdFallbackRequest(request, undefined)).toBeUndefined();
    });
  });

  describe('when merging the split into the grouped response', () => {
    const response = {
      rows: [group({ entityName: 'Code Agent' }, 5, 2), group({ entityName: null }, 7, null)],
      truncated: false,
    };
    const fallback = {
      rows: [group({ entityId: 'mastracode-outcome' }, 6), group({ entityId: 'mastracode-efficiency' }, 1, 3)],
      truncated: false,
    };

    it('replaces the unnamed group with one group per entityId, in the view order', () => {
      const merged = mergeTraceGroupEntityIdFallback(response, fallback, DEFAULT_TRACE_GROUP_SORT);
      expect(merged.rows.map(entry => getTraceGroupValue(entry, 'entityName'))).toEqual([
        'mastracode-outcome',
        'Code Agent',
        'mastracode-efficiency',
      ]);
      expect(merged.truncated).toBe(false);
    });

    it('sorts groups without the measure last in either direction', () => {
      for (const direction of ['asc', 'desc'] as const) {
        const merged = mergeTraceGroupEntityIdFallback(response, fallback, { measure: 'cost.sum', direction });
        expect(merged.rows.map(entry => getTraceGroupValue(entry, 'entityName')).at(-1)).toBe('mastracode-outcome');
      }
    });

    it('drills into an entityId group with the entity ID filter', () => {
      const merged = mergeTraceGroupEntityIdFallback(response, fallback, DEFAULT_TRACE_GROUP_SORT);
      const [first] = merged.rows;
      if (!first) throw new Error('expected a merged group');
      expect(getTraceGroupDrillDown(['entityName'], first)).toEqual({
        filters: [{ param: 'filterEntityId', value: 'mastracode-outcome', operatorId: 'is' }],
      });
    });

    it('reports truncation when the split pushes groups past the limit', () => {
      const many = {
        rows: Array.from({ length: 50 }, (_, index) => group({ entityId: `scorer-${index}` }, 1)),
        truncated: false,
      };
      const merged = mergeTraceGroupEntityIdFallback(response, many, DEFAULT_TRACE_GROUP_SORT);
      expect(merged.rows).toHaveLength(50);
      expect(merged.truncated).toBe(true);
    });
  });
});
