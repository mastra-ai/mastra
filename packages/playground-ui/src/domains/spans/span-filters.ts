import { EntityType, SpanType } from '@mastra/core/observability';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import type {
  FilterBarField,
  FilterBarOption,
  FilterBarSuggestionsResolver,
} from '../../ds/components/FilterBar/types';
import {
  isLegacyAnyValue,
  ROOT_ENTITY_TYPE_OPTIONS,
  TRACE_FILTER_BAR_LABELS,
  TRACE_NUMBER_OPERATORS,
  TRACE_PRESENCE_OPERATORS,
  TRACE_REQUIRED_STRING_OPERATORS,
  TRACE_STATUS_OPTIONS,
  TRACE_STRING_OPERATORS,
  TRACE_SYNTHETIC_OPERATORS,
  TRACE_TEXT_OPERATORS,
  traceFilterFieldColor,
  traceFilterFieldIcon,
} from '../traces/trace-filters';
import { isTraceFilterGroup, scalarPredicate } from '../traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterOperatorId, TraceFilterToken } from '../traces/trace-query-filters';

/** Span query fields every store accepts. `startedAt`/`endedAt` are left to the time-range chip. */
export const SPAN_CORE_FILTER_FIELD_IDS = [
  'name',
  'spanType',
  'status',
  'error',
  'durationMs',
  'timeToFirstChunkMs',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'rootEntityVersionId',
  'runId',
  'sessionId',
  'userId',
  'organizationId',
] as const;

/** Span query fields the server only accepts when the store declares `spanQueryContextFields`. */
export const SPAN_CONTEXT_FILTER_FIELD_IDS = [
  'traceId',
  'spanId',
  'parentSpanId',
  'threadId',
  'resourceId',
  'requestId',
  'serviceName',
  'experimentId',
  'environment',
  'executionSource',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
] as const;

const CORE_FIELD_IDS: ReadonlySet<string> = new Set(SPAN_CORE_FILTER_FIELD_IDS);
const ALL_FIELD_IDS: ReadonlySet<string> = new Set([...SPAN_CORE_FILTER_FIELD_IDS, ...SPAN_CONTEXT_FILTER_FIELD_IDS]);

const NUMBER_FIELD_IDS: ReadonlySet<string> = new Set(['durationMs', 'timeToFirstChunkMs']);
/** The query can only test `error` for presence; any other operator is rejected. */
const PRESENCE_ONLY_FIELD_IDS: ReadonlySet<string> = new Set(['error']);
/** Fields every span carries. On any other field, "is not X" must also keep spans where it is missing. */
const REQUIRED_FIELD_IDS: ReadonlySet<string> = new Set([
  'name',
  'spanType',
  'status',
  'traceId',
  'spanId',
  'durationMs',
]);

const SPAN_FILTER_BAR_LABELS: Record<string, string> = {
  ...TRACE_FILTER_BAR_LABELS,
  name: 'Span name',
  spanType: 'Span type',
  spanId: 'Span ID',
  parentSpanId: 'Parent span ID',
  error: 'Error',
  timeToFirstChunkMs: 'Time to first chunk (ms)',
  executionSource: 'Execution source',
  entityType: 'Primitive type',
  entityVersionId: 'Primitive version ID',
  parentEntityType: 'Parent primitive type',
  parentEntityId: 'Parent primitive ID',
  parentEntityName: 'Parent primitive name',
  parentEntityVersionId: 'Parent primitive version ID',
  rootEntityType: 'Root primitive type',
  rootEntityId: 'Root primitive ID',
  rootEntityName: 'Root primitive name',
  rootEntityVersionId: 'Root primitive version ID',
};

/** Span fields without their own trace icon borrow the icon of the closest trace field. */
const SPAN_ICON_FIELD_ALIASES: Record<string, string> = {
  name: 'spans.name',
  spanType: 'spans.spanType',
  error: 'spans.error',
  timeToFirstChunkMs: 'durationMs',
  spanId: 'traceId',
  parentSpanId: 'traceId',
  executionSource: 'runId',
  entityType: 'rootEntityType',
  parentEntityType: 'rootEntityType',
  entityVersionId: 'entityId',
  parentEntityId: 'entityId',
  parentEntityVersionId: 'entityId',
  rootEntityId: 'entityId',
  rootEntityVersionId: 'entityId',
  parentEntityName: 'entityName',
  rootEntityName: 'entityName',
};

const spanFieldBase = (id: string) => ({
  id,
  label: SPAN_FILTER_BAR_LABELS[id] ?? id,
  icon: traceFilterFieldIcon(SPAN_ICON_FIELD_ALIASES[id] ?? id),
  color: traceFilterFieldColor(id),
});

const humanize = (value: string) => {
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const byLabel = (a: { label?: string; value: string }, b: { label?: string; value: string }) =>
  (a.label ?? a.value).localeCompare(b.label ?? b.value);

const ENTITY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ROOT_ENTITY_TYPE_OPTIONS.map(option => [option.entityType, option.label]),
);

const SPAN_TYPE_OPTIONS: FilterBarOption[] = Object.values(SpanType)
  .map(value => ({ value, label: humanize(value) }))
  .sort(byLabel);

const ENTITY_TYPE_OPTIONS: FilterBarOption[] = Object.values(EntityType)
  .map(value => ({ value, label: ENTITY_TYPE_LABELS[value] ?? humanize(value) }))
  .sort(byLabel);

const STATUS_OPTIONS: FilterBarOption[] = TRACE_STATUS_OPTIONS.filter(option => option.value !== 'running').map(
  option => ({ value: option.value, label: option.label }),
);

/** FilterBar fields for the spans page: only paths and operators `querySpans()` accepts. */
export function createSpanFilterBarFields({
  withContextFields,
  entityNames,
  environments,
  valueSuggestions,
}: {
  /** Offer the context fields. Only when the server declares `spanQueryContextFields`. */
  withContextFields: boolean;
  entityNames: readonly string[];
  environments: readonly string[];
  /** Builds a lazy value resolver for a span field. Absent → free text. */
  valueSuggestions?: (path: string) => FilterBarSuggestionsResolver;
}): FilterBarField[] {
  const pick = (
    id: string,
    suggestions: FilterBarOption[],
    operators: TraceFilterOperatorId[] = TRACE_STRING_OPERATORS,
  ): FilterBarField => ({ ...spanFieldBase(id), operators, strict: true, suggestions });
  const names = entityNames.map(value => ({ value }));

  const field = (id: string): FilterBarField => {
    switch (id) {
      case 'status':
        return pick(id, STATUS_OPTIONS, TRACE_SYNTHETIC_OPERATORS);
      case 'spanType':
        return pick(id, SPAN_TYPE_OPTIONS, TRACE_REQUIRED_STRING_OPERATORS);
      case 'entityType':
      case 'parentEntityType':
      case 'rootEntityType':
        return pick(id, ENTITY_TYPE_OPTIONS);
      case 'entityName':
      case 'rootEntityName':
        return pick(id, names);
      case 'environment':
        return pick(
          id,
          environments.map(value => ({ value })),
        );
      case 'name': {
        const resolver = valueSuggestions?.(id);
        return {
          ...spanFieldBase(id),
          operators: TRACE_TEXT_OPERATORS,
          ...(resolver ? { strict: true, suggestions: resolver } : {}),
        };
      }
      case 'error':
        return { ...spanFieldBase(id), operators: TRACE_PRESENCE_OPERATORS };
      case 'durationMs':
      case 'timeToFirstChunkMs':
        return { ...spanFieldBase(id), type: 'number', operators: TRACE_NUMBER_OPERATORS };
      case 'traceId':
      case 'spanId':
        return { ...spanFieldBase(id), operators: TRACE_REQUIRED_STRING_OPERATORS };
      default:
        return { ...spanFieldBase(id), operators: TRACE_STRING_OPERATORS };
    }
  };

  const sortFields = (ids: readonly string[]) => ids.map(field).sort((a, b) => a.label.localeCompare(b.label));
  return [
    ...sortFields(SPAN_CORE_FILTER_FIELD_IDS),
    ...(withContextFields ? sortFields(SPAN_CONTEXT_FILTER_FIELD_IDS) : []),
  ];
}

function tokenToSpanQueryPredicate(
  token: TraceFilterToken,
  allowedFieldIds: ReadonlySet<string>,
): TraceQueryScalarPredicate | undefined {
  const { fieldId } = token;
  if (!allowedFieldIds.has(fieldId)) return undefined;
  const operatorId = token.operatorId ?? 'is';
  const isPresence = operatorId === 'exists' || operatorId === 'notExists';
  if (PRESENCE_ONLY_FIELD_IDS.has(fieldId) && !isPresence) return undefined;

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
  if (operatorId === 'matches' || operatorId === 'notMatches') {
    // The query rejects a text literal with no letters or digits.
    values = values.filter(value => /[\p{L}\p{M}\p{N}]/u.test(String(value)));
    if (!values.length) return undefined;
  }

  const predicate = scalarPredicate(operatorId, fieldId, values);
  if (!predicate) return undefined;
  if ((operatorId === 'isNot' || operatorId === 'notIn') && !REQUIRED_FIELD_IDS.has(fieldId)) {
    return { op: 'or', args: [predicate, { op: 'notExists', path: fieldId }] };
  }
  return predicate;
}

function groupToSpanQueryPredicate(
  group: TraceFilterGroup,
  allowedFieldIds: ReadonlySet<string>,
): TraceQueryScalarPredicate | undefined {
  const args = group.nodes
    .map(node =>
      isTraceFilterGroup(node)
        ? groupToSpanQueryPredicate(node, allowedFieldIds)
        : tokenToSpanQueryPredicate(node, allowedFieldIds),
    )
    .filter((predicate): predicate is TraceQueryScalarPredicate => Boolean(predicate));
  if (args.length === 0) return undefined;
  return args.length === 1 ? args[0] : { op: group.logic, args };
}

/**
 * The span query `where` for the filter bar's tokens and groups, or `undefined` when nothing applies.
 * Conditions the span query can't run (unknown fields, context fields without the capability,
 * unusable values) are left out instead of failing the request.
 */
export function buildSpanQueryWhere(
  tokens: TraceFilterToken[],
  groups: TraceFilterGroup[],
  { withContextFields }: { withContextFields: boolean },
): TraceQueryScalarPredicate | undefined {
  const allowedFieldIds = withContextFields ? ALL_FIELD_IDS : CORE_FIELD_IDS;
  const args = [
    ...tokens.map(token => tokenToSpanQueryPredicate(token, allowedFieldIds)),
    ...groups.map(group => groupToSpanQueryPredicate(group, allowedFieldIds)),
  ].filter((predicate): predicate is TraceQueryScalarPredicate => Boolean(predicate));
  return args.length ? { op: 'and', args } : undefined;
}
