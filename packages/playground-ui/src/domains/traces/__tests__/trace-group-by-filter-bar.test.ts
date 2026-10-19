import { describe, expect, it } from 'vitest';
import type { FilterBarItem } from '../../../ds/components/FilterBar/types';
import type { TraceGroupByDimension } from '../trace-group-by';
import {
  createTraceGroupByFilterBarFields,
  splitTraceGroupingFromFilterBar,
  traceGroupingToFilterBarItems,
} from '../trace-group-by-filter-bar';

const dimensions: TraceGroupByDimension[] = ['entityName', 'status', 'environment', 'entityType'];

const item = (fieldId: string, operatorId: string, value: FilterBarItem['value']): FilterBarItem => ({
  id: fieldId,
  fieldId,
  operatorId,
  value,
});

describe('createTraceGroupByFilterBarFields', () => {
  it('offers Group by with the offered dimensions as its values', () => {
    const [groupBy] = createTraceGroupByFilterBarFields({ dimensions: ['entityName', 'status'], grouped: false });
    expect(groupBy).toMatchObject({ id: 'groupBy', label: 'Group by', operators: ['in'], strict: true, hidden: false });
    expect(groupBy?.suggestions).toEqual([
      { value: 'entityName', label: 'Entity' },
      { value: 'status', label: 'Status' },
    ]);
  });

  it('offers Group by until grouped, then the group filters under their own heading', () => {
    const offered = (grouped: boolean) =>
      createTraceGroupByFilterBarFields({ dimensions, grouped })
        .filter(field => !field.hidden)
        .map(field => field.label);
    expect(offered(false)).toEqual(['Group by']);
    expect(offered(true)).toEqual([
      'Group trace count',
      'Group error rate (%)',
      'Group p50 duration (ms)',
      'Group p95 duration (ms)',
      'Group input tokens',
      'Group output tokens',
      'Group cost',
    ]);
    const sections = createTraceGroupByFilterBarFields({ dimensions, grouped: true }).map(field => field.section);
    expect(sections[0]).toBeUndefined();
    expect(new Set(sections.slice(1))).toEqual(new Set(['Group by filters']));
  });

  it('offers group filters for the measures shown as columns', () => {
    expect(
      createTraceGroupByFilterBarFields({ dimensions, grouped: true, measures: ['count', 'duration.p99', 'cost.avg'] })
        .slice(1)
        .map(field => [field.id, field.label]),
    ).toEqual([
      ['groupHaving.count', 'Group trace count'],
      ['groupHaving.duration.p99', 'Group p99 duration (ms)'],
      ['groupHaving.cost.avg', 'Group avg cost'],
    ]);
  });

  it('offers nothing new while disabled, and nothing at all without dimensions', () => {
    expect(
      createTraceGroupByFilterBarFields({ dimensions, grouped: true, disabled: true }).every(field => field.hidden),
    ).toBe(true);
    expect(createTraceGroupByFilterBarFields({ dimensions: [], grouped: false })).toEqual([]);
  });
});

describe('grouping chips', () => {
  it('shows the grouping as chips, with error rate as a percent', () => {
    expect(
      traceGroupingToFilterBarItems({
        groupBy: ['entityName', 'environment'],
        having: [
          { measure: 'errorRate', operatorId: 'gt', value: 0.07 },
          { measure: 'count', operatorId: 'gte', value: 10 },
        ],
      }),
    ).toEqual([
      item('groupBy', 'in', ['entityName', 'environment']),
      item('groupHaving.errorRate', 'gt', 7),
      item('groupHaving.count', 'gte', 10),
    ]);
    expect(traceGroupingToFilterBarItems({ groupBy: [], having: [] })).toEqual([]);
  });

  it('splits the grouping out of an edited bar and keeps the trace filters', () => {
    const filter = item('environment', 'is', 'production');
    const { grouping, nodes } = splitTraceGroupingFromFilterBar(
      [filter, item('groupBy', 'in', ['status', 'entityName']), item('groupHaving.errorRate', 'gt', 25)],
      dimensions,
    );
    expect(grouping).toEqual({
      groupBy: ['status', 'entityName'],
      having: [{ measure: 'errorRate', operatorId: 'gt', value: 0.25 }],
    });
    expect(nodes).toEqual([filter]);
  });

  it('keeps the first two dimensions and ignores ones the page does not offer', () => {
    const { grouping } = splitTraceGroupingFromFilterBar(
      [item('groupBy', 'in', ['projectId', 'environment', 'status', 'entityName'])],
      dimensions,
    );
    expect(grouping.groupBy).toEqual(['environment', 'status']);
  });

  it('drops group filters that are incomplete or left without a grouping', () => {
    expect(
      splitTraceGroupingFromFilterBar(
        [item('groupBy', 'in', ['status']), item('groupHaving.count', 'gt', ''), item('groupHaving.cost.sum', 'is', 1)],
        dimensions,
      ).grouping,
    ).toEqual({ groupBy: ['status'], having: [] });
    expect(splitTraceGroupingFromFilterBar([item('groupHaving.count', 'gt', 5)], dimensions).grouping).toEqual({
      groupBy: [],
      having: [],
    });
  });

  it('round-trips through the chips without drift', () => {
    const grouping = {
      groupBy: ['entityType' as const],
      having: [{ measure: 'errorRate' as const, operatorId: 'lte' as const, value: 0.07 }],
    };
    expect(splitTraceGroupingFromFilterBar(traceGroupingToFilterBarItems(grouping), dimensions).grouping).toEqual(
      grouping,
    );
  });
});
