import { EntityType } from '@mastra/core/observability';
import type { ListLogsArgs } from '@mastra/core/storage';
import type { LogLevel } from './types';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

export type LogsDatePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';

export type LogsEntityOptions = { label: string; entityType: EntityType };

export const LOGS_ROOT_ENTITY_TYPES = {
  AGENT: EntityType.AGENT,
  WORKFLOW: EntityType.WORKFLOW_RUN,
  SCORER: EntityType.SCORER,
  INGEST: EntityType.RAG_INGESTION,
} as const;

export const LOGS_ROOT_ENTITY_TYPE_OPTIONS = [
  { label: 'Agent', entityType: LOGS_ROOT_ENTITY_TYPES.AGENT },
  { label: 'Workflow', entityType: LOGS_ROOT_ENTITY_TYPES.WORKFLOW },
  { label: 'Scorer', entityType: LOGS_ROOT_ENTITY_TYPES.SCORER },
  { label: 'Ingest', entityType: LOGS_ROOT_ENTITY_TYPES.INGEST },
] as const satisfies readonly LogsEntityOptions[];

export const LOG_LEVEL_VALUES: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

export const LOG_LEVEL_OPTIONS = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
  { label: 'Fatal', value: 'fatal' },
] as const satisfies readonly { label: string; value: LogLevel }[];

export const LOGS_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
export const LOGS_DATE_PRESET_PARAM = 'datePreset';
export const LOGS_DATE_FROM_PARAM = 'dateFrom';
export const LOGS_DATE_TO_PARAM = 'dateTo';

export const LOGS_DATE_PRESET_VALUES = new Set<LogsDatePreset>([
  'all',
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
]);

/**
 * Generic filter URL params (filterX keys). Fields that carry multiple values
 * (tags, level) use repeated params; everything else is a single string.
 */
export const LOGS_PROPERTY_FILTER_PARAM_BY_FIELD = {
  level: 'filterLevel',
  tags: 'filterTags',
  entityName: 'filterEntityName',
  traceId: 'filterTraceId',
  spanId: 'filterSpanId',
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

export const LOGS_PROPERTY_FILTER_FIELD_IDS = Object.keys(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD) as Array<
  keyof typeof LOGS_PROPERTY_FILTER_PARAM_BY_FIELD
>;

/** Fields stored as repeated URL params (value is string[]). */
const LOGS_ARRAY_FIELD_IDS = new Set<string>(['tags']);

export const DEFAULT_LOGS_FILTERS_STORAGE_KEY = 'mastra:logs:saved-filters';

export function saveLogsFiltersToStorage(
  params: URLSearchParams,
  storageKey: string = DEFAULT_LOGS_FILTERS_STORAGE_KEY,
): void {
  const serialized = getPreservedLogsFilterParams(params);
  const preset = params.get(LOGS_DATE_PRESET_PARAM);
  if (preset) serialized.set(LOGS_DATE_PRESET_PARAM, preset);
  const from = params.get(LOGS_DATE_FROM_PARAM);
  if (from) serialized.set(LOGS_DATE_FROM_PARAM, from);
  const to = params.get(LOGS_DATE_TO_PARAM);
  if (to) serialized.set(LOGS_DATE_TO_PARAM, to);

  try {
    localStorage.setItem(storageKey, serialized.toString());
  } catch {
    // localStorage may be unavailable (private mode / quota) — silently skip.
  }
}

export function clearSavedLogsFilters(storageKey: string = DEFAULT_LOGS_FILTERS_STORAGE_KEY): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function loadLogsFiltersFromStorage(
  storageKey: string = DEFAULT_LOGS_FILTERS_STORAGE_KEY,
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

export function hasAnyLogsFilterParams(params: URLSearchParams): boolean {
  if (params.has(LOGS_DATE_PRESET_PARAM)) return true;
  if (params.has(LOGS_DATE_FROM_PARAM)) return true;
  if (params.has(LOGS_DATE_TO_PARAM)) return true;
  if (params.has(LOGS_ROOT_ENTITY_TYPE_PARAM)) return true;
  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    if (params.has(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId])) return true;
  }
  return false;
}

export function createLogsPropertyFilterFields({
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
      options: LOGS_ROOT_ENTITY_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.entityType })),
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
    {
      id: 'level',
      label: 'Level',
      kind: 'pick-multi',
      searchable: false,
      options: LOG_LEVEL_OPTIONS.map(o => ({ label: o.label, value: o.value })),
      placeholder: 'Choose level',
      emptyText: 'No levels.',
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
    { id: 'spanId', label: 'Span ID', kind: 'text' },
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
 * Read filter tokens from URL search params preserving the order in which
 * each filter was first added. Fields in LOGS_ARRAY_FIELD_IDS are read as
 * string[]; an empty sentinel (`filterX=`) keeps the pill alive post-Reset.
 */
export function getLogsPropertyFilterTokens(searchParams: URLSearchParams): PropertyFilterToken[] {
  const tokens: PropertyFilterToken[] = [];

  const paramToFieldId = new Map<string, string>([[LOGS_ROOT_ENTITY_TYPE_PARAM, 'rootEntityType']]);
  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    paramToFieldId.set(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId], fieldId);
  }

  const seen = new Set<string>();
  for (const [paramName] of searchParams.entries()) {
    const fieldId = paramToFieldId.get(paramName);
    if (!fieldId || seen.has(fieldId)) continue;
    seen.add(fieldId);

    if (LOGS_ARRAY_FIELD_IDS.has(fieldId)) {
      const raw = searchParams.getAll(paramName);
      if (raw.length === 0) continue;
      tokens.push({ fieldId, value: raw.filter(Boolean) });
      continue;
    }

    const value = searchParams.get(paramName);
    if (value !== null) tokens.push({ fieldId, value });
  }

  return tokens;
}

export function getPreservedLogsFilterParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams();

  const rootEntityType = searchParams.get(LOGS_ROOT_ENTITY_TYPE_PARAM);
  if (rootEntityType) next.set(LOGS_ROOT_ENTITY_TYPE_PARAM, rootEntityType);

  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    const param = LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    if (LOGS_ARRAY_FIELD_IDS.has(fieldId)) {
      for (const value of searchParams.getAll(param)) {
        next.append(param, value);
      }
      continue;
    }

    const value = searchParams.get(param);
    if (value) next.set(param, value);
  }

  return next;
}

export function applyLogsPropertyFilterTokens(params: URLSearchParams, tokens: PropertyFilterToken[]) {
  params.delete(LOGS_ROOT_ENTITY_TYPE_PARAM);
  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    params.delete(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
  }

  for (const token of tokens) {
    if (token.fieldId === 'rootEntityType' && typeof token.value === 'string') {
      params.set(LOGS_ROOT_ENTITY_TYPE_PARAM, token.value);
      continue;
    }

    const param =
      LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as keyof typeof LOGS_PROPERTY_FILTER_PARAM_BY_FIELD];
    if (!param) continue;

    if (LOGS_ARRAY_FIELD_IDS.has(token.fieldId) && Array.isArray(token.value)) {
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
      // survive URL round-trips. buildLogsListFilters skips these on the API
      // query side so neutrals never reach the backend.
      params.set(param, token.value.trim());
    }
  }
}

export function buildLogsListFilters({
  rootEntityType,
  dateFrom,
  dateTo,
  tokens,
}: {
  rootEntityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tokens: PropertyFilterToken[];
}): ListLogsArgs['filters'] {
  const filters: NonNullable<ListLogsArgs['filters']> = {};

  if (rootEntityType) {
    filters.rootEntityType = rootEntityType as NonNullable<ListLogsArgs['filters']>['rootEntityType'];
  }

  if (dateFrom || dateTo) {
    filters.timestamp = {
      ...(dateFrom ? { start: dateFrom } : {}),
      ...(dateTo ? { end: dateTo } : {}),
    };
  }

  for (const token of tokens) {
    if (token.fieldId === 'tags') {
      if (Array.isArray(token.value) && token.value.length > 0) {
        filters.tags = token.value;
      } else if (typeof token.value === 'string' && token.value.trim()) {
        filters.tags = [token.value.trim()];
      }
      continue;
    }

    if (token.fieldId === 'level') {
      // Single-select only — the server's `level` union (single LogLevel or
      // array) can't round-trip as a JSON-string array through the query-param
      // schema wrapper, so we send a single enum value. "Any" = no filter.
      if (typeof token.value === 'string' && token.value.trim() && token.value !== 'Any') {
        filters.level = token.value as LogLevel;
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
      case 'entityName':
        filters.rootEntityName = token.value;
        break;
      case 'traceId':
        filters.traceId = token.value;
        break;
      case 'spanId':
        filters.spanId = token.value;
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
 * "Clear" semantics for the logs toolbar: keep all filter pills but neutralize each value.
 * '' for text fields, 'Any' for single-select pick-multi, [] for multi-select pick-multi.
 * Date range is intentionally NOT touched here — that's a separate concern.
 */
export function neutralizeLogsFilterTokens(
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
