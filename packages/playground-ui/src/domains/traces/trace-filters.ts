import { EntityType } from '@mastra/core/observability';
import type { ListTracesArgs } from '@mastra/core/storage';
import type { TraceDatePreset } from './types';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

export type EntityOptions = { label: string; entityType: EntityType };

export const ROOT_ENTITY_TYPES = {
  AGENT: EntityType.AGENT,
  WORKFLOW: EntityType.WORKFLOW_RUN,
  SCORER: EntityType.SCORER,
  INGEST: EntityType.RAG_INGESTION,
} as const;

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

export const TRACE_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
export const TRACE_STATUS_PARAM = 'status';
export const TRACE_LIST_MODE_PARAM = 'listMode';
export const TRACE_LIST_MODE_VALUES = new Set(['traces', 'branches'] as const);
export type TraceListMode = 'traces' | 'branches';
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

/** Serialize the filter-related URL params (date + rootEntityType + status +
 *  generic filterX set) to localStorage so the user can restore them on next
 *  visit. Throws no errors — storage being unavailable is fine. */
export function saveTraceFiltersToStorage(
  params: URLSearchParams,
  storageKey: string = DEFAULT_TRACE_FILTERS_STORAGE_KEY,
): void {
  const serialized = getPreservedTraceFilterParams(params);
  const preset = params.get(TRACE_DATE_PRESET_PARAM);
  if (preset) serialized.set(TRACE_DATE_PRESET_PARAM, preset);
  const from = params.get(TRACE_DATE_FROM_PARAM);
  if (from) serialized.set(TRACE_DATE_FROM_PARAM, from);
  const to = params.get(TRACE_DATE_TO_PARAM);
  if (to) serialized.set(TRACE_DATE_TO_PARAM, to);

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
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    if (params.has(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId])) return true;
  }
  return false;
}

export function createTracePropertyFilterFields({
  availableTags,
  availableRootEntityNames,
  availableServiceNames,
  availableEnvironments,
  loading,
}: {
  availableTags: string[];
  availableRootEntityNames: string[];
  availableServiceNames: string[];
  availableEnvironments: string[];
  loading?: {
    tags?: boolean;
    entityNames?: boolean;
    serviceNames?: boolean;
    environments?: boolean;
  };
}): PropertyFilterField[] {
  const fields: PropertyFilterField[] = [
    {
      id: 'rootEntityType',
      label: 'Primitive Type',
      kind: 'pick-multi',
      searchable: false,
      options: ROOT_ENTITY_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.entityType })),
      placeholder: 'Choose entity type',
      emptyText: 'No entity types.',
    },
    {
      id: 'entityName',
      label: 'Primitive Name',
      kind: 'pick-multi',
      options: availableRootEntityNames.map(name => ({ label: name, value: name })),
      placeholder: 'Choose entity names',
      emptyText: 'No entity names found.',
      isLoading: loading?.entityNames,
    },
    { id: 'entityId', label: 'Primitive ID', kind: 'text' },
    {
      id: 'status',
      label: 'Status',
      kind: 'pick-multi',
      searchable: false,
      options: TRACE_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value })),
      placeholder: 'Choose status',
      emptyText: 'No statuses.',
    },
    {
      id: 'tags',
      label: 'Tags',
      kind: 'pick-multi',
      multi: true,
      options: availableTags.map(tag => ({ label: tag, value: tag })),
      placeholder: 'Choose tags',
      emptyText: 'No tags found.',
      isLoading: loading?.tags,
    },
    {
      id: 'serviceName',
      label: 'Service Name',
      kind: 'pick-multi',
      options: availableServiceNames.map(name => ({ label: name, value: name })),
      placeholder: 'Choose service names',
      emptyText: 'No service names found.',
      isLoading: loading?.serviceNames,
    },
    {
      id: 'environment',
      label: 'Environment',
      kind: 'pick-multi',
      options: availableEnvironments.map(env => ({ label: env, value: env })),
      placeholder: 'Choose environments',
      emptyText: 'No environments found.',
      isLoading: loading?.environments,
    },
    { id: 'traceId', label: 'Trace ID', kind: 'text' },
    { id: 'runId', label: 'Run ID', kind: 'text' },
    { id: 'threadId', label: 'Thread ID', kind: 'text' },
    { id: 'sessionId', label: 'Session ID', kind: 'text' },
    { id: 'requestId', label: 'Request ID', kind: 'text' },
    { id: 'resourceId', label: 'Resource ID', kind: 'text' },
    { id: 'userId', label: 'User ID', kind: 'text' },
    { id: 'organizationId', label: 'Organization ID', kind: 'text' },
    { id: 'experimentId', label: 'Experiment ID', kind: 'text' },
  ];
  const byLabel = (a: PropertyFilterField, b: PropertyFilterField) => a.label.localeCompare(b.label);
  const pickMulti = fields.filter(f => f.kind === 'pick-multi').sort(byLabel);
  const text = fields.filter(f => f.kind === 'text').sort(byLabel);
  return [...pickMulti, ...text];
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
    const fieldId = paramToFieldId.get(paramName);
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

  for (const token of tokens) {
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

/**
 * "Clear" semantics: keep all filter pills but neutralize each value.
 * '' for text fields, 'Any' for single-select pick-multi, [] for multi-select pick-multi.
 * Date range is intentionally NOT touched here — that's a separate concern.
 */
export function neutralizeFilterTokens(
  filterFields: PropertyFilterField[],
  filterTokens: PropertyFilterToken[],
): PropertyFilterToken[] {
  return filterTokens.map(token => {
    const field = filterFields.find(f => f.id === token.fieldId);
    if (!field) return token;
    if (field.kind === 'text') return { fieldId: token.fieldId, value: '' };
    if (field.kind === 'pick-multi') {
      return field.multi ? { fieldId: token.fieldId, value: [] } : { fieldId: token.fieldId, value: 'Any' };
    }
    return token;
  });
}
