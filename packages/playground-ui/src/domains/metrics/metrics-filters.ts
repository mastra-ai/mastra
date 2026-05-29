import { EntityType } from '@mastra/core/observability';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

/** Primitive type options — matches the traces filter vocabulary. */
export const METRICS_ROOT_ENTITY_TYPE_OPTIONS = [
  { label: 'Agent', entityType: EntityType.AGENT },
  { label: 'Workflow', entityType: EntityType.WORKFLOW_RUN },
  { label: 'Scorer', entityType: EntityType.SCORER },
  { label: 'Ingest', entityType: EntityType.RAG_INGESTION },
] as const;

/** Field IDs that live in dedicated URL params (not the generic `filterX` set). */
export const METRICS_SYNTHETIC_FILTER_FIELD_IDS = ['rootEntityType'] as const;

export const METRICS_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';

/** URL param name for each generic property filter field. Mirrors traces for
 *  cross-page URL consistency (user can copy a trace's filter URL and paste
 *  equivalent dimensions into metrics). */
export const METRICS_PROPERTY_FILTER_PARAM_BY_FIELD = {
  tags: 'filterTags',
  entityId: 'filterEntityId',
  entityName: 'filterEntityName',
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
  provider: 'filterProvider',
  model: 'filterModel',
} as const;

export type MetricsPropertyFilterFieldId = keyof typeof METRICS_PROPERTY_FILTER_PARAM_BY_FIELD;

export const METRICS_PROPERTY_FILTER_FIELD_IDS = Object.keys(
  METRICS_PROPERTY_FILTER_PARAM_BY_FIELD,
) as Array<MetricsPropertyFilterFieldId>;

const METRICS_FILTERS_STORAGE_KEY = 'mastra:metrics:saved-filters';

/** Save the current metrics filter URL params so the metrics page can restore
 *  them on next visit (same pattern as traces/logs). */
export function saveMetricsFiltersToStorage(params: URLSearchParams): void {
  const serialized = getPreservedMetricsFilterParams(params);
  try {
    localStorage.setItem(METRICS_FILTERS_STORAGE_KEY, serialized.toString());
  } catch {
    // localStorage may be unavailable — silently skip.
  }
}

export function clearSavedMetricsFilters(): void {
  try {
    localStorage.removeItem(METRICS_FILTERS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadMetricsFiltersFromStorage(): URLSearchParams | null {
  try {
    const raw = localStorage.getItem(METRICS_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = new URLSearchParams(raw);
    return parsed.toString() ? parsed : null;
  } catch {
    return null;
  }
}

export function hasAnyMetricsFilterParams(params: URLSearchParams): boolean {
  if (params.has(METRICS_ROOT_ENTITY_TYPE_PARAM)) return true;
  for (const fieldId of METRICS_PROPERTY_FILTER_FIELD_IDS) {
    if (params.has(METRICS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId])) return true;
  }
  return false;
}

/** Build the PropertyFilterField list shown in the metrics filter popover.
 *
 *  The field order is curated for OLAP efficiency: columnar/LowCardinality
 *  dimensions first, then bloom_filter-indexed high-cardinality IDs as
 *  free-text. Fields that are expensive to filter without an index are
 *  intentionally omitted from this dashboard surface. */
export function createMetricsPropertyFilterFields({
  availableTags,
  availableEntityNames,
  availableServiceNames,
  availableEnvironments,
  loading,
}: {
  availableTags: string[];
  availableEntityNames: string[];
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
      options: METRICS_ROOT_ENTITY_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.entityType })),
      placeholder: 'Choose entity type',
      emptyText: 'No entity types.',
    },
    {
      id: 'entityName',
      label: 'Primitive Name',
      kind: 'pick-multi',
      options: availableEntityNames.map(name => ({ label: name, value: name })),
      placeholder: 'Choose entity names',
      emptyText: 'No entity names found.',
      isLoading: loading?.entityNames,
    },
    { id: 'entityId', label: 'Primitive ID', kind: 'text' },
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
    // Provider / model are filterable by URL (filterProvider / filterModel) but
    // are omitted from the popover until we expose a discovery endpoint.
    // High-cardinality IDs — free-text. Backed by bloom_filter skip indexes on
    // ClickHouse, narrow timestamp range pruning on DuckDB.
    { id: 'threadId', label: 'Thread ID', kind: 'text' },
    { id: 'resourceId', label: 'Resource ID', kind: 'text' },
    { id: 'userId', label: 'User ID', kind: 'text' },
    { id: 'organizationId', label: 'Organization ID', kind: 'text' },
    { id: 'runId', label: 'Run ID', kind: 'text' },
    { id: 'sessionId', label: 'Session ID', kind: 'text' },
    { id: 'requestId', label: 'Request ID', kind: 'text' },
    { id: 'experimentId', label: 'Experiment ID', kind: 'text' },
  ];
  const byLabel = (a: PropertyFilterField, b: PropertyFilterField) => a.label.localeCompare(b.label);
  const pickMulti = fields.filter(f => f.kind === 'pick-multi').sort(byLabel);
  const text = fields.filter(f => f.kind === 'text').sort(byLabel);
  return [...pickMulti, ...text];
}

/** Parse filter tokens from URL params, preserving insertion order. */
export function getMetricsPropertyFilterTokens(searchParams: URLSearchParams): PropertyFilterToken[] {
  const tokens: PropertyFilterToken[] = [];

  const paramToFieldId = new Map<string, string>([[METRICS_ROOT_ENTITY_TYPE_PARAM, 'rootEntityType']]);
  for (const fieldId of METRICS_PROPERTY_FILTER_FIELD_IDS) {
    paramToFieldId.set(METRICS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId], fieldId);
  }

  const seen = new Set<string>();
  for (const [paramName] of searchParams.entries()) {
    const fieldId = paramToFieldId.get(paramName);
    if (!fieldId || seen.has(fieldId)) continue;
    seen.add(fieldId);

    if (fieldId === 'tags') {
      const raw = searchParams.getAll(paramName);
      if (raw.length === 0) continue;
      tokens.push({ fieldId, value: raw.filter(Boolean) });
      continue;
    }

    // Multi-value pick-multi fields: collect all occurrences.
    if (
      fieldId === 'rootEntityType' ||
      fieldId === 'entityName' ||
      fieldId === 'serviceName' ||
      fieldId === 'environment' ||
      fieldId === 'provider' ||
      fieldId === 'model'
    ) {
      const raw = searchParams.getAll(paramName);
      if (raw.length > 1) {
        tokens.push({ fieldId, value: raw });
        continue;
      }
    }

    const value = searchParams.get(paramName);
    if (value !== null) tokens.push({ fieldId, value });
  }

  return tokens;
}

/** Return a fresh URLSearchParams containing only metrics filter params. */
export function getPreservedMetricsFilterParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  const rootEntityValues = searchParams.getAll(METRICS_ROOT_ENTITY_TYPE_PARAM);
  for (const v of rootEntityValues) next.append(METRICS_ROOT_ENTITY_TYPE_PARAM, v);

  for (const fieldId of METRICS_PROPERTY_FILTER_FIELD_IDS) {
    const param = METRICS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    const values = searchParams.getAll(param);
    for (const v of values) next.append(param, v);
  }
  return next;
}

/** Mutate `params` in place: strip every metrics filter param, then re-write
 *  them from `tokens` in order. Token insertion order drives URL order so
 *  filter pill order is stable across reloads. */
export function applyMetricsPropertyFilterTokens(params: URLSearchParams, tokens: PropertyFilterToken[]): void {
  params.delete(METRICS_ROOT_ENTITY_TYPE_PARAM);
  for (const fieldId of METRICS_PROPERTY_FILTER_FIELD_IDS) {
    params.delete(METRICS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
  }

  for (const token of tokens) {
    const paramName =
      token.fieldId === 'rootEntityType'
        ? METRICS_ROOT_ENTITY_TYPE_PARAM
        : METRICS_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as MetricsPropertyFilterFieldId];
    if (!paramName) continue;

    if (Array.isArray(token.value)) {
      const values = token.value.filter(v => typeof v === 'string' && v !== '');
      if (values.length === 0) {
        // Keep an empty sentinel for `tags` so the pill survives a Reset.
        if (token.fieldId === 'tags') params.append(paramName, '');
        continue;
      }
      for (const v of values) params.append(paramName, v);
    } else if (typeof token.value === 'string') {
      // Persist even empty / 'Any' strings so newly-created pills (and
      // neutralized-but-still-visible pills after a Reset) survive URL
      // round-trips. `buildMetricsDimensionalFilter` drops these on the API
      // query side so neutrals never reach the backend.
      params.set(paramName, token.value.trim());
    }
  }
}

/** Shape of the dimensional filter object fed into `MetricsFilter` on client
 *  calls. Kept compatible with `metricsFilterSchema` in @internal/core — every
 *  scalar field maps to a single-string column filter, and `tags` is the only
 *  array field (matched via `has()` / equivalent on backends). */
export type MetricsDimensionalFilter = {
  rootEntityType?: EntityType;
  entityName?: string;
  entityId?: string;
  tags?: string[];
  serviceName?: string;
  environment?: string;
  provider?: string;
  model?: string;
  threadId?: string;
  resourceId?: string;
  userId?: string;
  organizationId?: string;
  runId?: string;
  sessionId?: string;
  requestId?: string;
  experimentId?: string;
};

/** Convert the active token list into a `MetricsFilter`-compatible object.
 *
 *  Single-value text fields are assigned as strings; `pick-multi` fields are
 *  assigned as string arrays. Empty/neutral values are dropped. */
/** "Neutral" sentinel for single-select pick-multi fields. Emitted by the
 *  toolbar's Clear action so pills stay visible after reset; must be stripped
 *  before the filter object is sent to the backend (it is not a valid enum
 *  option for fields like `rootEntityType`). */
const NEUTRAL_PICK_VALUE = 'Any';

function isNeutralValue(v: string): boolean {
  const trimmed = v.trim();
  return trimmed === '' || trimmed === NEUTRAL_PICK_VALUE;
}

/** `rootEntityType` is enum-valued at the backend; URL-supplied or stale stored
 *  values can be arbitrary strings, so we validate against the allowed set
 *  before letting them reach the filter object. Returns `undefined` if the
 *  value isn't a known enum option. */
const VALID_ROOT_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(
  METRICS_ROOT_ENTITY_TYPE_OPTIONS.map(o => o.entityType),
);
function toValidRootEntityType(v: string): EntityType | undefined {
  const trimmed = v.trim();
  return VALID_ROOT_ENTITY_TYPES.has(trimmed as EntityType) ? (trimmed as EntityType) : undefined;
}

export function buildMetricsDimensionalFilter(tokens: PropertyFilterToken[]): MetricsDimensionalFilter {
  const result: MetricsDimensionalFilter = {};
  for (const token of tokens) {
    const fieldId = token.fieldId as keyof MetricsDimensionalFilter;
    if (Array.isArray(token.value)) {
      const values = token.value
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => !isNeutralValue(v));
      if (values.length === 0) continue;
      if (fieldId === 'tags') {
        result.tags = values;
      } else if (fieldId === 'rootEntityType') {
        const validated = toValidRootEntityType(values[0]);
        if (validated) result.rootEntityType = validated;
      } else {
        // Backend accepts a single string per dimension; take the first selection.
        (result as Record<string, unknown>)[fieldId] = values[0];
      }
    } else if (typeof token.value === 'string') {
      if (isNeutralValue(token.value)) continue;
      const trimmed = token.value.trim();
      if (fieldId === 'rootEntityType') {
        const validated = toValidRootEntityType(trimmed);
        if (validated) result.rootEntityType = validated;
      } else {
        (result as Record<string, unknown>)[fieldId] = trimmed;
      }
    }
  }
  return result;
}
