import type { EntityType } from '@mastra/core/observability';
import type { ListTracesArgs } from '@mastra/core/storage';
import {
  ActivityIcon,
  BoxIcon,
  BracesIcon,
  BuildingIcon,
  ClockIcon,
  FingerprintIcon,
  FlaskConicalIcon,
  GlobeIcon,
  HashIcon,
  LayersIcon,
  MessageSquareIcon,
  PlayIcon,
  RadioIcon,
  ServerIcon,
  TagIcon,
  TagsIcon,
  UserIcon,
  WaypointsIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS } from './trace-query-filters';
import type { TraceDatePreset } from './types';
import type {
  FilterBarField,
  FilterBarItem,
  FilterBarOperator,
  FilterBarSuggestionsResolver,
} from '@/ds/components/FilterBar/types';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
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
} as const;

export const TRACE_PROPERTY_FILTER_FIELD_IDS = Object.keys(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD) as Array<
  keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD
>;

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

/** The trace query API only runs equality (`eq`) and set membership (`in`)
 *  predicates, so the FilterBar offers exactly those two operators. */
export const TRACE_FILTER_BAR_OPERATORS: FilterBarOperator[] = [
  { id: 'is', label: 'is' },
  { id: 'in', label: 'in', arity: 'many' },
];

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
}: {
  availableRootEntityNames: string[];
  availableEnvironments: string[];
  hiddenFieldIds?: readonly string[];
  /** Discovered `metadata.<key>` paths with a lazy value-suggestions resolver each. */
  metadataFields?: readonly { path: string; suggestions: FilterBarSuggestionsResolver }[];
}): FilterBarField[] {
  const pick = (id: string, suggestions: { value: string; label?: string }[]): FilterBarField => ({
    ...traceFieldBase(id),
    operators: ['is'],
    strict: true,
    suggestions,
  });
  const text = (id: string): FilterBarField => ({ ...traceFieldBase(id), operators: ['is'] });

  const pickFields: FilterBarField[] = [
    pick(
      'rootEntityType',
      ROOT_ENTITY_TYPE_OPTIONS.map(o => ({ value: o.entityType, label: o.label })),
    ),
    pick(
      'entityName',
      availableRootEntityNames.map(name => ({ value: name })),
    ),
    pick(
      'status',
      TRACE_STATUS_OPTIONS.filter(o => o.value !== 'running').map(o => ({ value: o.value, label: o.label })),
    ),
    pick(
      'environment',
      availableEnvironments.map(env => ({ value: env })),
    ),
  ];
  const textFields = TRACE_FILTER_BAR_TEXT_FIELD_IDS.map(text);
  const metadataBarFields: FilterBarField[] = metadataFields
    .filter(({ path }) => isTraceMetadataFieldId(path))
    .map(({ path, suggestions }) => ({
      id: path,
      label: path.slice(TRACE_METADATA_FILTER_FIELD_PREFIX.length),
      icon: BracesIcon,
      color: stringToThemedColor(path),
      operators: ['is'],
      suggestions,
    }));

  const byLabel = (a: FilterBarField, b: FilterBarField) => a.label.localeCompare(b.label);
  const hidden = new Set(hiddenFieldIds);
  return [...pickFields.sort(byLabel), ...textFields.sort(byLabel), ...metadataBarFields.sort(byLabel)]
    .filter(field => !TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(field.id))
    .map(field => (hidden.has(field.id) ? { ...field, hidden: true } : field));
}

/** One FilterBar item per token, keyed by field id so chip order == URL order.
 *  Empty values ('' / []) are kept: that's a pending chip whose field was just
 *  changed and whose value hasn't been picked yet (the query builder skips it).
 *  Only the legacy 'Any' sentinel is mapped back to an empty value. */
export function traceTokensToFilterBarItems(tokens: PropertyFilterToken[]): FilterBarItem[] {
  return tokens.map(token => ({
    id: token.fieldId,
    fieldId: token.fieldId,
    operatorId: token.fieldId === 'tags' ? 'in' : 'is',
    value: token.value === 'Any' ? '' : token.value,
  }));
}

export function filterBarItemsToTraceTokens(items: FilterBarItem[]): PropertyFilterToken[] {
  return items.map(item => ({
    fieldId: item.fieldId,
    value: Array.isArray(item.value) ? item.value.map(String) : String(item.value),
  }));
}

/**
 * Read filter tokens from URL search params preserving the order in which each
 * filter was first added (URLSearchParams iterates in insertion order). This
 * is used by the Filter popover + PropertyFilterApplied pills so the UI reflects the
 * order the user created the filters in.
 */
export function getTracePropertyFilterTokens(searchParams: URLSearchParams): PropertyFilterToken[] {
  const tokens: PropertyFilterToken[] = [];

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
    const fieldId = isTraceMetadataParam(paramName) ? metadataParamToFieldId(paramName) : paramToFieldId.get(paramName);
    if (!fieldId || seen.has(fieldId)) continue;
    seen.add(fieldId);

    if (fieldId === 'tags') {
      const raw = searchParams.getAll(paramName);
      if (raw.length === 0) continue;
      // An empty `filterTags=` sentinel keeps the pill alive after a Reset
      // (neutral state = no selections) so users can re-pick without losing
      // the pill's position. Non-empty entries are the actual selected tags.
      tokens.push({ fieldId, value: raw.filter(Boolean) });
      continue;
    }

    // Text and synthetic single-value fields: include empty strings so
    // pending-but-not-yet-filled filters survive URL round-trips.
    const value = searchParams.get(paramName);
    if (value !== null) tokens.push({ fieldId, value });
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

  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    const param = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    if (fieldId === 'tags') {
      for (const value of searchParams.getAll(param)) {
        next.append(param, value);
      }
      continue;
    }

    const value = searchParams.get(param);
    if (value) {
      next.set(param, value);
    }
  }

  for (const [param, value] of searchParams.entries()) {
    if (isTraceMetadataParam(param) && value) next.set(param, value);
  }

  return next;
}

/**
 * Clear all filter params from `params` and re-add them in the given `tokens`
 * order so the URL (and therefore the PropertyFilterApplied pills) reflects the
 * creation order of filters. Handles the generic `filterX` params plus the
 * dedicated synthetic params (rootEntityType, status).
 */
export function applyTracePropertyFilterTokens(params: URLSearchParams, tokens: PropertyFilterToken[]) {
  params.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
  params.delete(TRACE_STATUS_PARAM);
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    params.delete(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
  }
  for (const param of Array.from(params.keys())) {
    if (isTraceMetadataParam(param)) params.delete(param);
  }

  for (const token of tokens) {
    if (isTraceMetadataFieldId(token.fieldId)) {
      if (typeof token.value === 'string') params.set(metadataFieldIdToParam(token.fieldId), token.value.trim());
      continue;
    }
    if (token.fieldId === 'rootEntityType' && typeof token.value === 'string') {
      params.set(TRACE_ROOT_ENTITY_TYPE_PARAM, token.value);
      continue;
    }
    if (token.fieldId === 'status' && typeof token.value === 'string') {
      params.set(TRACE_STATUS_PARAM, token.value);
      continue;
    }

    const param =
      TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD];
    if (!param) continue;

    if (token.fieldId === 'tags' && Array.isArray(token.value)) {
      if (token.value.length === 0) {
        // Empty sentinel — keeps the pill visible after Reset.
        params.append(param, '');
      } else {
        for (const value of token.value) {
          params.append(param, value);
        }
      }
      continue;
    }

    if (typeof token.value === 'string') {
      // Persist empty / 'Any' values too so neutralized-but-still-visible pills
      // survive URL round-trips. buildTraceListFilters skips these on the API
      // query side so neutrals never reach the backend.
      params.set(param, token.value.trim());
    }
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
