import type { EntityType } from '@mastra/core/observability';
import type { ListTracesArgs } from '@mastra/core/storage';
import {
  ActivityIcon,
  BoxIcon,
  BracesIcon,
  BuildingIcon,
  ClockIcon,
  CloudIcon,
  CpuIcon,
  FingerprintIcon,
  FlaskConicalIcon,
  GaugeIcon,
  GitBranchIcon,
  GlobeIcon,
  HashIcon,
  LayersIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PercentIcon,
  PlayIcon,
  RadioIcon,
  ServerIcon,
  ShapesIcon,
  StarIcon,
  TagIcon,
  TagsIcon,
  ThumbsUpIcon,
  TimerIcon,
  TriangleAlertIcon,
  UserIcon,
  WaypointsIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TraceMetadataFilterField } from './hooks/use-trace-metadata-filter-fields';
import {
  isTraceFilterOperatorId,
  TRACE_QUERY_NUMERIC_FIELD_IDS,
  TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS,
} from './trace-query-filters';
import type { TraceFilterOperatorId, TraceFilterToken, TraceQueryRelatedScope } from './trace-query-filters';
import type { TraceDatePreset } from './types';
import type {
  FilterBarField,
  FilterBarItem,
  FilterBarOperator,
  FilterBarSuggestionsResolver,
} from '@/ds/components/FilterBar/types';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

export type { TraceFilterOperatorId, TraceFilterToken, TraceQueryRelatedScope } from './trace-query-filters';
import { stringToThemedColor, themedHueColor } from '@/lib/colors';

type EntityTypeValue = `${EntityType}`;

export type EntityOptions = { label: string; entityType: EntityTypeValue };

export const ROOT_ENTITY_TYPES = {
  AGENT: 'agent',
  WORKFLOW: 'workflow_run',
  SCORER: 'scorer',
  INGEST: 'rag_ingestion',
} as const satisfies Record<string, EntityTypeValue>;

export const ROOT_ENTITY_TYPE_OPTIONS = [
  { label: 'Agent', entityType: ROOT_ENTITY_TYPES.AGENT },
  { label: 'Workflow', entityType: ROOT_ENTITY_TYPES.WORKFLOW },
  { label: 'Scorer', entityType: ROOT_ENTITY_TYPES.SCORER },
  { label: 'Ingest', entityType: ROOT_ENTITY_TYPES.INGEST },
] as const satisfies readonly EntityOptions[];

export type TraceStatusFilter = 'running' | 'success' | 'error';

export const TRACE_STATUS_OPTIONS = [
  { label: 'Running', value: 'running' },
  { label: 'Success', value: 'success' },
  { label: 'Error', value: 'error' },
] as const satisfies readonly { label: string; value: TraceStatusFilter }[];

/** Field ids for "synthetic" filter entries — they live in dedicated URL params
 *  rather than the generic `filter*` set, but appear as rows in the Filter
 *  popover so users can manage all filters from one place. */
export const TRACE_SYNTHETIC_FILTER_FIELD_IDS = ['rootEntityType', 'status'] as const;

/** Discovered `metadata.<key>` fields are dynamic, so they use a prefix-based URL
 *  scheme (`filterMetadata.<key>`) instead of the fixed `filter*` param map. */
export const TRACE_METADATA_FILTER_FIELD_PREFIX = 'metadata.';
export const TRACE_METADATA_FILTER_PARAM_PREFIX = 'filterMetadata.';

export const isTraceMetadataFieldId = (fieldId: string) =>
  fieldId.startsWith(TRACE_METADATA_FILTER_FIELD_PREFIX) && fieldId.length > TRACE_METADATA_FILTER_FIELD_PREFIX.length;

const isTraceMetadataParam = (param: string) =>
  param.startsWith(TRACE_METADATA_FILTER_PARAM_PREFIX) && param.length > TRACE_METADATA_FILTER_PARAM_PREFIX.length;

export const metadataFieldIdToParam = (fieldId: string) =>
  TRACE_METADATA_FILTER_PARAM_PREFIX + fieldId.slice(TRACE_METADATA_FILTER_FIELD_PREFIX.length);

export const metadataParamToFieldId = (param: string) =>
  TRACE_METADATA_FILTER_FIELD_PREFIX + param.slice(TRACE_METADATA_FILTER_PARAM_PREFIX.length);

export const TRACE_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
export const TRACE_STATUS_PARAM = 'status';
export const TRACE_LIST_MODE_PARAM = 'listMode';
/** Branch-mode only: identifies the anchor span that defines the displayed subtree.
 *  Stable across intra-panel span navigation (which only changes `spanId`). */
export const TRACE_ANCHOR_SPAN_ID_PARAM = 'anchorSpanId';
export const TRACE_LIST_MODE_VALUES = new Set(['traces', 'branches'] as const);
export type TraceListMode = 'traces' | 'branches';

export const TRACE_LIST_MODE_OPTIONS = [
  { label: 'Traces (default)', value: 'traces' },
  { label: 'Branches', value: 'branches' },
] as const satisfies readonly { label: string; value: TraceListMode }[];
export const TRACE_DATE_PRESET_PARAM = 'datePreset';
export const TRACE_DATE_FROM_PARAM = 'dateFrom';
export const TRACE_DATE_TO_PARAM = 'dateTo';

export const TRACE_DATE_PRESET_VALUES = new Set<TraceDatePreset>([
  'all',
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
]);

export const TRACE_PROPERTY_FILTER_PARAM_BY_FIELD = {
  tags: 'filterTags',
  entityId: 'filterEntityId',
  entityName: 'filterEntityName',
  traceId: 'filterTraceId',
  runId: 'filterRunId',
  threadId: 'filterThreadId',
  sessionId: 'filterSessionId',
  requestId: 'filterRequestId',
  resourceId: 'filterResourceId',
  userId: 'filterUserId',
  organizationId: 'filterOrganizationId',
  serviceName: 'filterServiceName',
  environment: 'filterEnvironment',
  experimentId: 'filterExperimentId',
  'spans.name': 'filterSpanName',
  'spans.spanType': 'filterSpanType',
  'spans.model': 'filterSpanModel',
  'spans.provider': 'filterSpanProvider',
  'spans.durationMs': 'filterSpanDurationMs',
  'spans.error': 'filterSpanError',
  'scores.scorerId': 'filterScorerId',
  'scores.score': 'filterScore',
  'feedback.feedbackType': 'filterFeedbackType',
  'feedback.value': 'filterFeedbackValue',
  'feedback.comment': 'filterFeedbackComment',
} as const;

export const TRACE_PROPERTY_FILTER_FIELD_IDS = Object.keys(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD) as Array<
  keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD
>;

/** The operator of a filter lives in a sibling `<valueParam>.op` param; omitted
 *  means the default (`is`). Metadata keys cannot contain dots, so the suffix is
 *  unambiguous. */
export const TRACE_FILTER_OPERATOR_PARAM_SUFFIX = '.op';
export const traceFilterOperatorParam = (valueParam: string) => valueParam + TRACE_FILTER_OPERATOR_PARAM_SUFFIX;
const isTraceFilterOperatorParam = (param: string) => param.endsWith(TRACE_FILTER_OPERATOR_PARAM_SUFFIX);

const isPresenceOperator = (operatorId: TraceFilterOperatorId | undefined) =>
  operatorId === 'exists' || operatorId === 'notExists';
const isManyOperator = (operatorId: TraceFilterOperatorId | undefined) => operatorId === 'in' || operatorId === 'notIn';

/** Default operator for a token without one: arrays mean set membership. */
export const traceFilterTokenOperator = (token: TraceFilterToken): TraceFilterOperatorId =>
  token.operatorId ?? (Array.isArray(token.value) ? 'in' : 'is');

const readTraceFilterOperator = (searchParams: URLSearchParams, valueParam: string) => {
  const raw = searchParams.get(traceFilterOperatorParam(valueParam));
  return raw !== null && isTraceFilterOperatorId(raw) ? raw : undefined;
};

export const TRACE_STATUS_VALUES = new Set<TraceStatusFilter>(['running', 'success', 'error']);

export const DEFAULT_TRACE_FILTERS_STORAGE_KEY = 'mastra:traces:saved-filters';

/** Serialize the filter-related URL params (relative date preset + rootEntityType +
 *  status + generic filterX set) to localStorage so the user can restore them on next
 *  visit. A `custom` absolute range is never saved: it would be stale by the next visit.
 *  An empty set clears the key. Throws no errors — storage being unavailable is fine. */
export function saveTraceFiltersToStorage(
  params: URLSearchParams,
  storageKey: string = DEFAULT_TRACE_FILTERS_STORAGE_KEY,
): void {
  const serialized = getPreservedTraceFilterParams(params);
  const preset = params.get(TRACE_DATE_PRESET_PARAM);
  if (preset && preset !== 'custom') serialized.set(TRACE_DATE_PRESET_PARAM, preset);

  if (!serialized.toString()) {
    clearSavedTraceFilters(storageKey);
    return;
  }

  try {
    localStorage.setItem(storageKey, serialized.toString());
  } catch {
    // localStorage may be unavailable (private mode / quota) — silently skip.
  }
}

/** Forget any previously saved filter set. Called from the "Remove filters"
 *  action so the next plain sidebar nav lands on an empty page. */
export function clearSavedTraceFilters(storageKey: string = DEFAULT_TRACE_FILTERS_STORAGE_KEY): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore — storage may be unavailable
  }
}

/** Read a previously saved filter set and return it as URLSearchParams, or
 *  null if nothing is saved or storage is unavailable. */
export function loadTraceFiltersFromStorage(
  storageKey: string = DEFAULT_TRACE_FILTERS_STORAGE_KEY,
): URLSearchParams | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = new URLSearchParams(raw);
    return parsed.toString() ? parsed : null;
  } catch {
    return null;
  }
}

/** True when `params` carries any filter-related key — used to decide whether
 *  to hydrate from localStorage on page mount (we only hydrate when the URL is
 *  filter-clean, i.e. the user landed here via a plain sidebar nav). */
export function hasAnyTraceFilterParams(params: URLSearchParams): boolean {
  if (params.has(TRACE_DATE_PRESET_PARAM)) return true;
  if (params.has(TRACE_DATE_FROM_PARAM)) return true;
  if (params.has(TRACE_DATE_TO_PARAM)) return true;
  if (params.has(TRACE_ROOT_ENTITY_TYPE_PARAM)) return true;
  if (params.has(TRACE_STATUS_PARAM)) return true;
  if (params.has(TRACE_LIST_MODE_PARAM)) return true;
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    if (params.has(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId])) return true;
  }
  for (const param of params.keys()) {
    if (isTraceMetadataParam(param)) return true;
  }
  return false;
}

/** Every operator the trace query API supports, keyed by the UI id that goes in the URL. */
export const TRACE_FILTER_BAR_OPERATORS: (FilterBarOperator & { id: TraceFilterOperatorId })[] = [
  { id: 'is', label: 'is' },
  { id: 'isNot', label: 'is not' },
  { id: 'in', label: 'is any of', arity: 'many' },
  { id: 'notIn', label: 'is none of', arity: 'many' },
  { id: 'exists', label: 'exists', arity: 'none' },
  { id: 'notExists', label: 'does not exist', arity: 'none' },
  { id: 'gt', label: '>' },
  { id: 'gte', label: '≥' },
  { id: 'lt', label: '<' },
  { id: 'lte', label: '≤' },
];

const TRACE_STRING_OPERATORS: TraceFilterOperatorId[] = ['is', 'isNot', 'in', 'notIn', 'exists', 'notExists'];
/** Fields every trace carries (`traceId`, `entityName`): presence operators would never be false. */
const TRACE_REQUIRED_STRING_OPERATORS: TraceFilterOperatorId[] = ['is', 'isNot', 'in', 'notIn'];
const TRACE_NUMBER_OPERATORS: TraceFilterOperatorId[] = [
  'is',
  'isNot',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists',
  'notExists',
];
const TRACE_PRESENCE_OPERATORS: TraceFilterOperatorId[] = ['exists', 'notExists'];
/** Synthetic fields live in a single dedicated URL param, so they cannot carry an operator. */
const TRACE_SYNTHETIC_OPERATORS: TraceFilterOperatorId[] = ['is', 'in'];

const TRACE_FILTER_BAR_LABELS: Record<string, string> = {
  rootEntityType: 'Primitive Type',
  entityName: 'Primitive Name',
  entityId: 'Primitive ID',
  status: 'Status',
  tags: 'Tags',
  serviceName: 'Service Name',
  environment: 'Environment',
  traceId: 'Trace ID',
  runId: 'Run ID',
  threadId: 'Thread ID',
  sessionId: 'Session ID',
  requestId: 'Request ID',
  resourceId: 'Resource ID',
  userId: 'User ID',
  organizationId: 'Organization ID',
  experimentId: 'Experiment ID',
  'spans.name': 'Span name',
  'spans.spanType': 'Span type',
  'spans.model': 'Model',
  'spans.provider': 'Provider',
  'spans.durationMs': 'Span duration (ms)',
  'spans.error': 'Span error',
  'scores.scorerId': 'Scorer',
  'scores.score': 'Score',
  'feedback.feedbackType': 'Feedback type',
  'feedback.value': 'Feedback value',
  'feedback.comment': 'Feedback comment',
};

/** Icon and hue for each known trace filter key. Hues are spread by hand — hashing
 *  the ids clusters them (e.g. `environment`/`entityName`/`timeRange` all land on green). */
const TRACE_FILTER_BAR_FIELD_META: Record<string, { icon: LucideIcon; hue: number }> = {
  timeRange: { icon: ClockIcon, hue: 30 },
  rootEntityType: { icon: BoxIcon, hue: 265 },
  entityName: { icon: TagIcon, hue: 290 },
  entityId: { icon: FingerprintIcon, hue: 315 },
  status: { icon: ActivityIcon, hue: 0 },
  tags: { icon: TagsIcon, hue: 340 },
  serviceName: { icon: ServerIcon, hue: 175 },
  environment: { icon: GlobeIcon, hue: 145 },
  traceId: { icon: WaypointsIcon, hue: 215 },
  runId: { icon: PlayIcon, hue: 195 },
  threadId: { icon: MessageSquareIcon, hue: 235 },
  sessionId: { icon: LayersIcon, hue: 100 },
  requestId: { icon: RadioIcon, hue: 55 },
  resourceId: { icon: HashIcon, hue: 80 },
  userId: { icon: UserIcon, hue: 20 },
  organizationId: { icon: BuildingIcon, hue: 120 },
  experimentId: { icon: FlaskConicalIcon, hue: 160 },
  'spans.name': { icon: GitBranchIcon, hue: 250 },
  'spans.spanType': { icon: ShapesIcon, hue: 275 },
  'spans.model': { icon: CpuIcon, hue: 300 },
  'spans.provider': { icon: CloudIcon, hue: 205 },
  'spans.durationMs': { icon: TimerIcon, hue: 40 },
  'spans.error': { icon: TriangleAlertIcon, hue: 10 },
  'scores.scorerId': { icon: GaugeIcon, hue: 130 },
  'scores.score': { icon: PercentIcon, hue: 110 },
  'feedback.feedbackType': { icon: ThumbsUpIcon, hue: 185 },
  'feedback.value': { icon: StarIcon, hue: 45 },
  'feedback.comment': { icon: MessageCircleIcon, hue: 225 },
};

export const traceFilterFieldIcon = (fieldId: string) => TRACE_FILTER_BAR_FIELD_META[fieldId]?.icon;

/** Stable per-field accent; known keys use a curated hue, others fall back to a hashed one. */
export const traceFilterFieldColor = (fieldId: string) => {
  const hue = TRACE_FILTER_BAR_FIELD_META[fieldId]?.hue;
  return hue === undefined ? stringToThemedColor(fieldId) : themedHueColor(hue);
};

const traceFieldBase = (id: string) => ({
  id,
  label: TRACE_FILTER_BAR_LABELS[id] ?? id,
  icon: traceFilterFieldIcon(id),
  color: traceFilterFieldColor(id),
});

const TRACE_FILTER_BAR_TEXT_FIELD_IDS = [
  'entityId',
  'traceId',
  'runId',
  'threadId',
  'sessionId',
  'requestId',
  'resourceId',
  'userId',
  'organizationId',
  'experimentId',
] as const;

const TRACE_FILTER_BAR_RELATED_FIELD_IDS = [
  'spans.name',
  'spans.spanType',
  'spans.model',
  'spans.provider',
  'spans.durationMs',
  'spans.error',
  'scores.scorerId',
  'scores.score',
  'feedback.feedbackType',
  'feedback.value',
  'feedback.comment',
] as const;
type TraceFilterRelatedFieldId = (typeof TRACE_FILTER_BAR_RELATED_FIELD_IDS)[number];

const TRACE_FILTER_BAR_PRESENCE_FIELD_IDS = new Set<string>(['spans.error', 'feedback.comment']);

const byLabel = (a: FilterBarField, b: FilterBarField) => a.label.localeCompare(b.label);

/** FilterBar field definitions for the trace pages. Fields the query API cannot
 *  filter on (see `TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS`) are omitted, as is the
 *  `running` status, so no chip advertises a filter that has no effect. Hidden
 *  fields are never offered in the input's field step but still label existing
 *  (e.g. scoped, read-only) chips. */
export function createTraceFilterBarFields({
  availableRootEntityNames,
  availableEnvironments,
  hiddenFieldIds = [],
  metadataFields = [],
  valueSuggestions,
}: {
  availableRootEntityNames: string[];
  availableEnvironments: string[];
  hiddenFieldIds?: readonly string[];
  /** Discovered `metadata.<key>` paths with a lazy value-suggestions resolver each. */
  metadataFields?: readonly TraceMetadataFilterField[];
  /** Builds a lazy value resolver for a related-scope field (`spans.model`, …). Absent → free text. */
  valueSuggestions?: (scope: TraceQueryRelatedScope, path: string) => FilterBarSuggestionsResolver;
}): FilterBarField[] {
  const pick = (
    id: string,
    suggestions: { value: string; label?: string }[],
    operators: TraceFilterOperatorId[] = TRACE_STRING_OPERATORS,
  ): FilterBarField => ({
    ...traceFieldBase(id),
    operators,
    strict: true,
    suggestions,
  });
  const text = (id: string): FilterBarField => ({
    ...traceFieldBase(id),
    operators: id === 'traceId' ? TRACE_REQUIRED_STRING_OPERATORS : TRACE_STRING_OPERATORS,
  });
  const relatedPick = (id: TraceFilterRelatedFieldId): FilterBarField => {
    const [scope, path] = id.split('.') as [TraceQueryRelatedScope, string];
    const resolver = valueSuggestions?.(scope, path);
    return {
      ...traceFieldBase(id),
      operators: TRACE_STRING_OPERATORS,
      ...(resolver ? { strict: true, suggestions: resolver } : {}),
    };
  };
  const number = (id: string): FilterBarField => ({
    ...traceFieldBase(id),
    type: 'number',
    operators: TRACE_NUMBER_OPERATORS,
  });
  const presence = (id: string): FilterBarField => ({ ...traceFieldBase(id), operators: TRACE_PRESENCE_OPERATORS });

  const pickFields: FilterBarField[] = [
    pick(
      'rootEntityType',
      ROOT_ENTITY_TYPE_OPTIONS.map(o => ({ value: o.entityType, label: o.label })),
      TRACE_SYNTHETIC_OPERATORS,
    ),
    pick(
      'entityName',
      availableRootEntityNames.map(name => ({ value: name })),
      TRACE_REQUIRED_STRING_OPERATORS,
    ),
    pick(
      'status',
      TRACE_STATUS_OPTIONS.filter(o => o.value !== 'running').map(o => ({ value: o.value, label: o.label })),
      TRACE_SYNTHETIC_OPERATORS,
    ),
    pick(
      'environment',
      availableEnvironments.map(env => ({ value: env })),
    ),
  ];
  const textFields = TRACE_FILTER_BAR_TEXT_FIELD_IDS.map(text);
  const relatedFields = (['spans', 'scores', 'feedback'] as const).flatMap(scope =>
    TRACE_FILTER_BAR_RELATED_FIELD_IDS.filter(id => id.startsWith(`${scope}.`))
      .map(id => {
        if (TRACE_QUERY_NUMERIC_FIELD_IDS.has(id)) return number(id);
        if (TRACE_FILTER_BAR_PRESENCE_FIELD_IDS.has(id)) return presence(id);
        return relatedPick(id);
      })
      .sort(byLabel),
  );
  const metadataBarFields: FilterBarField[] = metadataFields
    .filter(({ path }) => isTraceMetadataFieldId(path))
    .map(({ path, suggestions }) => ({
      id: path,
      label: path.slice(TRACE_METADATA_FILTER_FIELD_PREFIX.length),
      icon: BracesIcon,
      color: stringToThemedColor(path),
      operators: TRACE_STRING_OPERATORS,
      suggestions,
    }));

  const hidden = new Set(hiddenFieldIds);
  return [
    ...pickFields.sort(byLabel),
    ...textFields.sort(byLabel),
    ...relatedFields,
    ...metadataBarFields.sort(byLabel),
  ]
    .filter(field => !TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(field.id))
    .map(field => (hidden.has(field.id) ? { ...field, hidden: true } : field));
}

/** One FilterBar item per token, keyed by field id so chip order == URL order.
 *  Empty values ('' / []) are kept: that's a pending chip whose field was just
 *  changed and whose value hasn't been picked yet (the query builder skips it).
 *  Only the legacy 'Any' sentinel is mapped back to an empty value. */
export function traceTokensToFilterBarItems(tokens: TraceFilterToken[]): FilterBarItem[] {
  return tokens.map(token => ({
    id: token.fieldId,
    fieldId: token.fieldId,
    operatorId: traceFilterTokenOperator(token),
    value: token.value === 'Any' ? '' : token.value,
  }));
}

export function filterBarItemsToTraceTokens(items: FilterBarItem[]): TraceFilterToken[] {
  return items.map(item => {
    const token: TraceFilterToken = {
      fieldId: item.fieldId,
      value: Array.isArray(item.value) ? item.value.map(String) : String(item.value),
    };
    // Only carry a non-default operator so tokens stay minimal (and URLs stay short).
    if (isTraceFilterOperatorId(item.operatorId) && item.operatorId !== traceFilterTokenOperator(token)) {
      token.operatorId = item.operatorId;
    }
    return token;
  });
}

/**
 * Read filter tokens from URL search params preserving the order in which each
 * filter was first added (URLSearchParams iterates in insertion order). This
 * is used by the Filter popover + PropertyFilterApplied pills so the UI reflects the
 * order the user created the filters in.
 */
export function getTracePropertyFilterTokens(searchParams: URLSearchParams): TraceFilterToken[] {
  const tokens: TraceFilterToken[] = [];

  // Map URL param name → fieldId for both generic filterX params and the
  // dedicated synthetic params (rootEntityType, status).
  const paramToFieldId = new Map<string, string>([
    [TRACE_ROOT_ENTITY_TYPE_PARAM, 'rootEntityType'],
    [TRACE_STATUS_PARAM, 'status'],
  ]);
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    paramToFieldId.set(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId], fieldId);
  }

  const seen = new Set<string>();
  for (const [paramName] of searchParams.entries()) {
    if (isTraceFilterOperatorParam(paramName)) continue;
    const fieldId = isTraceMetadataParam(paramName) ? metadataParamToFieldId(paramName) : paramToFieldId.get(paramName);
    if (!fieldId || seen.has(fieldId)) continue;
    seen.add(fieldId);

    const operatorId = readTraceFilterOperator(searchParams, paramName);
    const raw = searchParams.getAll(paramName);

    if (fieldId === 'tags' || isManyOperator(operatorId)) {
      // An empty `filterTags=` sentinel keeps the pill alive after a Reset
      // (neutral state = no selections) so users can re-pick without losing
      // the pill's position. Non-empty entries are the actual selected values.
      tokens.push({ fieldId, value: raw.filter(Boolean), ...(operatorId ? { operatorId } : {}) });
      continue;
    }

    // Text and synthetic single-value fields: include empty strings so
    // pending-but-not-yet-filled filters survive URL round-trips.
    const value = raw[0];
    if (value !== undefined) tokens.push({ fieldId, value, ...(operatorId ? { operatorId } : {}) });
  }

  return tokens;
}

export function getPreservedTraceFilterParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams();

  const rootEntityType = searchParams.get(TRACE_ROOT_ENTITY_TYPE_PARAM);
  if (rootEntityType) next.set(TRACE_ROOT_ENTITY_TYPE_PARAM, rootEntityType);

  const status = searchParams.get(TRACE_STATUS_PARAM);
  if (status) next.set(TRACE_STATUS_PARAM, status);

  const listMode = searchParams.get(TRACE_LIST_MODE_PARAM);
  if (listMode) next.set(TRACE_LIST_MODE_PARAM, listMode);

  const preserve = (param: string) => {
    const operatorId = readTraceFilterOperator(searchParams, param);
    const values = searchParams.getAll(param).filter(value => value || isPresenceOperator(operatorId));
    if (!values.length) return;
    for (const value of values) next.append(param, value);
    if (operatorId) next.set(traceFilterOperatorParam(param), operatorId);
  };

  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    const param = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    if (fieldId === 'tags') {
      for (const value of searchParams.getAll(param)) {
        next.append(param, value);
      }
      continue;
    }
    preserve(param);
  }

  const seenMetadata = new Set<string>();
  for (const param of searchParams.keys()) {
    if (!isTraceMetadataParam(param) || isTraceFilterOperatorParam(param) || seenMetadata.has(param)) continue;
    seenMetadata.add(param);
    preserve(param);
  }

  return next;
}

/**
 * Clear all filter params from `params` and re-add them in the given `tokens`
 * order so the URL (and therefore the PropertyFilterApplied pills) reflects the
 * creation order of filters. Handles the generic `filterX` params plus the
 * dedicated synthetic params (rootEntityType, status).
 */
export function applyTracePropertyFilterTokens(params: URLSearchParams, tokens: TraceFilterToken[]) {
  params.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
  params.delete(TRACE_STATUS_PARAM);
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    const param = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    params.delete(param);
    params.delete(traceFilterOperatorParam(param));
  }
  for (const param of Array.from(params.keys())) {
    if (isTraceMetadataParam(param)) params.delete(param);
  }

  for (const token of tokens) {
    if (token.fieldId === 'rootEntityType' && typeof token.value === 'string') {
      params.set(TRACE_ROOT_ENTITY_TYPE_PARAM, token.value);
      continue;
    }
    if (token.fieldId === 'status' && typeof token.value === 'string') {
      params.set(TRACE_STATUS_PARAM, token.value);
      continue;
    }

    const param = isTraceMetadataFieldId(token.fieldId)
      ? metadataFieldIdToParam(token.fieldId)
      : TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD];
    if (!param) continue;

    if (Array.isArray(token.value)) {
      if (token.value.length === 0) {
        // Empty sentinel — keeps the pill visible after Reset.
        params.append(param, '');
      } else {
        for (const value of token.value) {
          params.append(param, value);
        }
      }
    } else {
      // Persist empty / 'Any' values too so neutralized-but-still-visible pills
      // survive URL round-trips. The query builder skips these so neutrals
      // never reach the backend.
      params.set(param, token.value.trim());
    }

    const operatorId = traceFilterTokenOperator(token);
    const defaultOperator = Array.isArray(token.value) ? 'in' : 'is';
    if (operatorId !== defaultOperator) params.set(traceFilterOperatorParam(param), operatorId);
  }
}

export function buildTraceListFilters({
  rootEntityType,
  status,
  dateFrom,
  dateTo,
  tokens,
}: {
  rootEntityType?: string;
  status?: TraceStatusFilter;
  dateFrom?: Date;
  dateTo?: Date;
  tokens: PropertyFilterToken[];
}): ListTracesArgs['filters'] {
  const filters: NonNullable<ListTracesArgs['filters']> = {};

  if (rootEntityType) {
    filters.entityType = rootEntityType as NonNullable<ListTracesArgs['filters']>['entityType'];
  }

  if (status) {
    filters.status = status as NonNullable<ListTracesArgs['filters']>['status'];
  }

  if (dateFrom) {
    filters.startedAt = { start: dateFrom };
  }

  if (dateTo) {
    filters.endedAt = { end: dateTo };
  }

  for (const token of tokens) {
    if (token.fieldId === 'tags') {
      if (Array.isArray(token.value) && token.value.length > 0) {
        filters.tags = token.value;
      } else if (typeof token.value === 'string' && token.value.trim()) {
        // pick-multi tags: single-string token → wrap for the server's array schema.
        filters.tags = [token.value.trim()];
      }
      continue;
    }

    if (typeof token.value !== 'string') continue;
    // Skip empty-string tokens (unfilled pending filters) and 'Any'
    // (pick-multi single-select neutral state) so neutrals never reach the
    // backend.
    if (!token.value.trim()) continue;
    if (token.value === 'Any') continue;

    switch (token.fieldId) {
      case 'entityId':
        filters.entityId = token.value;
        break;
      case 'entityName':
        filters.entityName = token.value;
        break;
      case 'traceId':
        filters.traceId = token.value;
        break;
      case 'runId':
        filters.runId = token.value;
        break;
      case 'threadId':
        filters.threadId = token.value;
        break;
      case 'sessionId':
        filters.sessionId = token.value;
        break;
      case 'requestId':
        filters.requestId = token.value;
        break;
      case 'resourceId':
        filters.resourceId = token.value;
        break;
      case 'userId':
        filters.userId = token.value;
        break;
      case 'organizationId':
        filters.organizationId = token.value;
        break;
      case 'serviceName':
        filters.serviceName = token.value;
        break;
      case 'environment':
        filters.environment = token.value;
        break;
      case 'experimentId':
        filters.experimentId = token.value;
        break;
      default:
        break;
    }
  }

  return filters;
}
