import { EntityType } from '@mastra/core/observability';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import {
  isLegacyAnyValue,
  ROOT_ENTITY_TYPE_OPTIONS,
  TRACE_FILTER_BAR_LABELS,
  TRACE_NUMBER_OPERATORS,
  TRACE_REQUIRED_STRING_OPERATORS,
  TRACE_STATUS_OPTIONS,
  TRACE_STRING_OPERATORS,
  traceFilterFieldColor,
  traceFilterFieldIcon,
} from '../traces/trace-filters';
import { isTraceFilterGroup, scalarPredicate } from '../traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterOperatorId, TraceFilterToken } from '../traces/trace-query-filters';
import type { FilterBarField, FilterBarOption } from '@/ds/components/FilterBar/types';

/** Thread query fields the filter bar offers. `startedAt`/`endedAt` are left to the time-range chip. */
export const THREAD_FILTER_FIELD_IDS = [
  'status',
  'traceCount',
  'timeToFirstChunkMs',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'threadId',
  'resourceId',
  'userId',
  'organizationId',
  'runId',
  'sessionId',
  'requestId',
  'serviceName',
  'experimentId',
  'environment',
  'executionSource',
] as const;

const FIELD_IDS: ReadonlySet<string> = new Set(THREAD_FILTER_FIELD_IDS);
const NUMBER_FIELD_IDS: ReadonlySet<string> = new Set(['traceCount', 'timeToFirstChunkMs']);
/** Fields every thread row carries. On any other field, "is not X" must also keep threads where it is missing. */
const REQUIRED_FIELD_IDS: ReadonlySet<string> = new Set(['threadId', 'status', 'traceCount']);
/** The thread query compares `traceCount` but has no set membership or presence check for it. */
const TRACE_COUNT_OPERATORS: TraceFilterOperatorId[] = ['is', 'isNot', 'gt', 'gte', 'lt', 'lte'];

const THREAD_FILTER_BAR_LABELS: Record<string, string> = {
  ...TRACE_FILTER_BAR_LABELS,
  traceCount: 'Messages',
  timeToFirstChunkMs: 'Time to first chunk (ms)',
  executionSource: 'Execution source',
  entityType: 'Primitive type',
  entityVersionId: 'Primitive version ID',
};

/** Thread fields without their own trace icon borrow the icon of the closest trace field. */
const THREAD_ICON_FIELD_ALIASES: Record<string, string> = {
  traceCount: 'traceId',
  timeToFirstChunkMs: 'durationMs',
  executionSource: 'runId',
  entityType: 'rootEntityType',
  entityVersionId: 'entityId',
};

const threadFieldBase = (id: string) => ({
  id,
  label: THREAD_FILTER_BAR_LABELS[id] ?? id,
  icon: traceFilterFieldIcon(THREAD_ICON_FIELD_ALIASES[id] ?? id),
  color: traceFilterFieldColor(id),
});

const humanize = (value: string) => {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ENTITY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ROOT_ENTITY_TYPE_OPTIONS.map(option => [option.entityType, option.label]),
);

const ENTITY_TYPE_OPTIONS: FilterBarOption[] = Object.values(EntityType)
  .map(value => ({ value, label: ENTITY_TYPE_LABELS[value] ?? humanize(value) }))
  .sort((a, b) => a.label.localeCompare(b.label));

const STATUS_OPTIONS: FilterBarOption[] = TRACE_STATUS_OPTIONS.filter(option => option.value !== 'running').map(
  option => ({ value: option.value, label: option.label }),
);

/** FilterBar fields for the threads page: only paths and operators `queryTraceThreads()` accepts. */
export function createThreadFilterBarFields({
  entityNames,
  environments,
}: {
  entityNames: readonly string[];
  environments: readonly string[];
}): FilterBarField[] {
  const pick = (
    id: string,
    suggestions: FilterBarOption[],
    operators: TraceFilterOperatorId[] = TRACE_STRING_OPERATORS,
  ): FilterBarField => ({ ...threadFieldBase(id), operators, strict: true, suggestions });

  const field = (id: string): FilterBarField => {
    switch (id) {
      case 'status':
        return pick(id, STATUS_OPTIONS, TRACE_REQUIRED_STRING_OPERATORS);
      case 'entityType':
        return pick(id, ENTITY_TYPE_OPTIONS);
      case 'entityName':
        return pick(
          id,
          entityNames.map(value => ({ value })),
        );
      case 'environment':
        return pick(
          id,
          environments.map(value => ({ value })),
        );
      case 'traceCount':
        return { ...threadFieldBase(id), type: 'number', operators: TRACE_COUNT_OPERATORS };
      case 'timeToFirstChunkMs':
        return { ...threadFieldBase(id), type: 'number', operators: TRACE_NUMBER_OPERATORS };
      case 'threadId':
        return { ...threadFieldBase(id), operators: TRACE_REQUIRED_STRING_OPERATORS };
      default:
        return { ...threadFieldBase(id), operators: TRACE_STRING_OPERATORS };
    }
  };

  return THREAD_FILTER_FIELD_IDS.map(field).sort((a, b) => a.label.localeCompare(b.label));
}

function tokenToThreadQueryPredicate(token: TraceFilterToken): TraceQueryScalarPredicate | undefined {
  const { fieldId } = token;
  if (!FIELD_IDS.has(fieldId)) return undefined;
  const operatorId = token.operatorId ?? 'is';
  const isPresence = operatorId === 'exists' || operatorId === 'notExists';

  const rawValues = (Array.isArray(token.value) ? token.value : [token.value]).filter(
    (value): value is string =>
      typeof value === 'string' && Boolean(value.trim()) && !isLegacyAnyValue(value, operatorId),
  );
  if (!rawValues.length && !isPresence) return undefined;

  let values: (string | number)[] = rawValues;
  if (NUMBER_FIELD_IDS.has(fieldId)) {
    values = rawValues.map(Number).filter(value => !Number.isNaN(value));
    if (!values.length && !isPresence) return undefined;
  }
  if (fieldId === 'traceCount' && (isPresence || values.length > 1 || !TRACE_COUNT_OPERATORS.includes(operatorId))) {
    return undefined;
  }

  const predicate = scalarPredicate(operatorId, fieldId, values);
  if (!predicate) return undefined;
  if ((operatorId === 'isNot' || operatorId === 'notIn') && !REQUIRED_FIELD_IDS.has(fieldId)) {
    return { op: 'or', args: [predicate, { op: 'notExists', path: fieldId }] };
  }
  return predicate;
}

function groupToThreadQueryPredicate(group: TraceFilterGroup): TraceQueryScalarPredicate | undefined {
  const args = group.nodes
    .map(node => (isTraceFilterGroup(node) ? groupToThreadQueryPredicate(node) : tokenToThreadQueryPredicate(node)))
    .filter((predicate): predicate is TraceQueryScalarPredicate => Boolean(predicate));
  if (args.length === 0) return undefined;
  return args.length === 1 ? args[0] : { op: group.logic, args };
}

/**
 * The thread query `where` for the filter bar's tokens and groups, or `undefined` when nothing applies.
 * Conditions the thread query can't run (unknown fields, unusable values) are left out instead of
 * failing the request.
 */
export function buildThreadQueryWhere(
  tokens: TraceFilterToken[],
  groups: TraceFilterGroup[],
): TraceQueryScalarPredicate | undefined {
  const args = [...tokens.map(tokenToThreadQueryPredicate), ...groups.map(groupToThreadQueryPredicate)].filter(
    (predicate): predicate is TraceQueryScalarPredicate => Boolean(predicate),
  );
  return args.length ? { op: 'and', args } : undefined;
}
