import { GroupIcon, SigmaIcon } from 'lucide-react';
import { traceFilterFieldColor } from './trace-filters';
import {
  DEFAULT_TRACE_GROUP_COLUMNS,
  TRACE_GROUP_BY_DIMENSION_LABELS,
  TRACE_GROUP_BY_MAX_DIMENSIONS,
  TRACE_GROUP_BY_MEASURE_LABELS,
  TRACE_GROUP_BY_MEASURES,
  TRACE_GROUP_HAVING_OPERATORS,
} from './trace-group-by';
import type { TraceGroupByDimension, TraceGroupByMeasure, TraceGroupHaving, TraceGrouping } from './trace-group-by';
import type { FilterBarField, FilterBarItem, FilterBarNode } from '@/ds/components/FilterBar/types';
import { isFilterBarGroup } from '@/ds/components/FilterBar/types';

/** FilterBar field of the Group by chip: `Group by  Entity, Environment`. */
export const TRACE_GROUP_BY_FIELD_ID = 'groupBy';

const HAVING_FIELD_PREFIX = 'groupHaving.';

export const traceGroupHavingFieldId = (measure: TraceGroupByMeasure) => `${HAVING_FIELD_PREFIX}${measure}`;

const havingFieldLabel = (measure: TraceGroupByMeasure) => {
  if (measure === 'count') return 'Group trace count';
  const label = `Group ${TRACE_GROUP_BY_MEASURE_LABELS[measure].toLowerCase()}`;
  if (measure === 'errorRate') return `${label} (%)`;
  return measure.startsWith('duration.') ? `${label} (ms)` : label;
};

// Error rate is a ratio on the wire but typed as a percent in the bar.
const toDisplayValue = (measure: TraceGroupByMeasure, value: number) =>
  measure === 'errorRate' ? Math.round(value * 100 * 1e6) / 1e6 : value;
const fromDisplayValue = (measure: TraceGroupByMeasure, value: number) =>
  measure === 'errorRate' ? Math.round((value / 100) * 1e9) / 1e9 : value;

const measureForHavingField = (fieldId: string): TraceGroupByMeasure | undefined =>
  fieldId.startsWith(HAVING_FIELD_PREFIX)
    ? TRACE_GROUP_BY_MEASURES.find(measure => measure === fieldId.slice(HAVING_FIELD_PREFIX.length))
    : undefined;

/** True for the chips that describe the grouped view rather than filter traces. */
export const isTraceGroupingFieldId = (fieldId: string) =>
  fieldId === TRACE_GROUP_BY_FIELD_ID || measureForHavingField(fieldId) !== undefined;

/**
 * FilterBar fields for the grouped view: `Group by` (pick up to two dimensions) and, while grouped, one
 * `Group <measure>` number field per visible column (`measures`) to keep only matching groups.
 *
 * `disabled` keeps existing chips readable but stops new ones being added, e.g. where the list shows nested traces.
 */
export function createTraceGroupByFilterBarFields({
  dimensions,
  grouped,
  measures = DEFAULT_TRACE_GROUP_COLUMNS,
  disabled = false,
}: {
  dimensions: readonly TraceGroupByDimension[];
  grouped: boolean;
  /** Measures offered as group filters; defaults to the standard columns. Pass the visible columns plus those already filtered on. */
  measures?: readonly TraceGroupByMeasure[];
  disabled?: boolean;
}): FilterBarField[] {
  if (dimensions.length === 0) return [];
  const groupByField: FilterBarField = {
    id: TRACE_GROUP_BY_FIELD_ID,
    label: 'Group by',
    icon: GroupIcon,
    color: traceFilterFieldColor(TRACE_GROUP_BY_FIELD_ID),
    type: 'text',
    operators: ['in'],
    suggestions: dimensions.map(dimension => ({ value: dimension, label: TRACE_GROUP_BY_DIMENSION_LABELS[dimension] })),
    strict: true,
    hidden: disabled,
  };
  const havingFields = TRACE_GROUP_BY_MEASURES.filter(measure => measures.includes(measure)).map<FilterBarField>(
    measure => ({
      id: traceGroupHavingFieldId(measure),
      label: havingFieldLabel(measure),
      icon: SigmaIcon,
      color: traceFilterFieldColor(TRACE_GROUP_BY_FIELD_ID),
      type: 'number',
      operators: [...TRACE_GROUP_HAVING_OPERATORS],
      hidden: disabled || !grouped,
    }),
  );
  return [groupByField, ...havingFields];
}

/** The grouped view as FilterBar items, keyed by field id like the trace filters. */
export function traceGroupingToFilterBarItems({ groupBy, having }: TraceGrouping): FilterBarItem[] {
  if (groupBy.length === 0) return [];
  return [
    { id: TRACE_GROUP_BY_FIELD_ID, fieldId: TRACE_GROUP_BY_FIELD_ID, operatorId: 'in', value: [...groupBy] },
    ...having.map(({ measure, operatorId, value }) => {
      const id = traceGroupHavingFieldId(measure);
      return { id, fieldId: id, operatorId, value: toDisplayValue(measure, value) };
    }),
  ];
}

/**
 * Split the grouped-view chips out of an edited FilterBar value. Returns the grouping they describe and the
 * remaining nodes (trace filters). Only the first two dimensions are kept; group filters without a dimension
 * to group by are dropped.
 */
export function splitTraceGroupingFromFilterBar(
  nodes: readonly FilterBarNode[],
  dimensions: readonly TraceGroupByDimension[],
): { grouping: TraceGrouping; nodes: FilterBarNode[] } {
  const rest: FilterBarNode[] = [];
  const groupBy: TraceGroupByDimension[] = [];
  const having: TraceGroupHaving[] = [];
  for (const node of nodes) {
    if (isFilterBarGroup(node) || !isTraceGroupingFieldId(node.fieldId)) {
      rest.push(node);
      continue;
    }
    if (node.fieldId === TRACE_GROUP_BY_FIELD_ID) {
      const values = Array.isArray(node.value) ? node.value : [node.value];
      for (const value of values) {
        const dimension = dimensions.find(candidate => candidate === value);
        if (dimension && !groupBy.includes(dimension)) groupBy.push(dimension);
      }
      continue;
    }
    const measure = measureForHavingField(node.fieldId);
    const operatorId = TRACE_GROUP_HAVING_OPERATORS.find(op => op === node.operatorId);
    const value = typeof node.value === 'number' ? node.value : Number(node.value);
    if (!measure || !operatorId || Array.isArray(node.value) || node.value === '' || !Number.isFinite(value)) continue;
    if (having.some(existing => existing.measure === measure)) continue;
    having.push({ measure, operatorId, value: fromDisplayValue(measure, value) });
  }
  const dimensionsKept = groupBy.slice(0, TRACE_GROUP_BY_MAX_DIMENSIONS);
  return { grouping: { groupBy: dimensionsKept, having: dimensionsKept.length > 0 ? having : [] }, nodes: rest };
}
