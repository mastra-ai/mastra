export const TRACE_OPTIONAL_COLUMNS = [
  'type',
  'input',
  'duration',
  'endTime',
  'environment',
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'estimatedCost',
] as const;

export type TraceOptionalColumn = (typeof TRACE_OPTIONAL_COLUMNS)[number];

export const TRACE_USAGE_COLUMNS = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'estimatedCost',
] as const satisfies readonly TraceOptionalColumn[];

/** Trace properties that are not regular columns but can be pinned as a custom column. */
export const TRACE_CUSTOM_COLUMN_FIELDS = ['traceId', 'threadId', 'resourceId', 'entityId', 'startedAt'] as const;

export type TraceCustomColumn = (typeof TRACE_CUSTOM_COLUMN_FIELDS)[number];

export const TRACE_CUSTOM_COLUMN_LABELS: Record<TraceCustomColumn, string> = {
  traceId: 'Trace ID',
  threadId: 'Thread ID',
  resourceId: 'Resource ID',
  entityId: 'Entity ID',
  startedAt: 'Started at',
};

export type TraceColumnPreferences = {
  readonly visibleColumns: readonly TraceOptionalColumn[];
  readonly customColumns: readonly TraceCustomColumn[];
  readonly metadataKeys: readonly string[];
};

export type TraceUsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  costUnit?: string;
};

export const DEFAULT_TRACE_COLUMN_PREFERENCES: TraceColumnPreferences = {
  visibleColumns: ['type', 'input', 'duration', 'estimatedCost'],
  customColumns: [],
  metadataKeys: [],
};

// v2: 'entity' became 'type' and moved before Name; duration + cost joined the defaults.
// v3: added `customColumns`; a v2 payload is migrated rather than reset.
const TRACE_COLUMN_PREFERENCES_VERSION = 3;
const TRACE_COLUMN_PREFERENCES_MIGRATABLE_VERSIONS = new Set<unknown>([2, TRACE_COLUMN_PREFERENCES_VERSION]);
const TRACE_COLUMN_SET = new Set<string>(TRACE_OPTIONAL_COLUMNS);
const TRACE_USAGE_COLUMN_SET = new Set<TraceOptionalColumn>(TRACE_USAGE_COLUMNS);
const TRACE_CUSTOM_COLUMN_SET = new Set<string>(TRACE_CUSTOM_COLUMN_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTraceOptionalColumn(value: unknown): value is TraceOptionalColumn {
  return typeof value === 'string' && TRACE_COLUMN_SET.has(value);
}

export function isTraceCustomColumn(value: unknown): value is TraceCustomColumn {
  return typeof value === 'string' && TRACE_CUSTOM_COLUMN_SET.has(value);
}

function uniqueMetadataKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const keys = value
    .filter(key => typeof key === 'string')
    .map(key => key.trim())
    .filter(Boolean);

  return [...new Set(keys)];
}

export function parseTraceColumnPreferences(serialized: string | undefined): TraceColumnPreferences {
  if (!serialized) return DEFAULT_TRACE_COLUMN_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || !TRACE_COLUMN_PREFERENCES_MIGRATABLE_VERSIONS.has(parsed.version)) {
      return DEFAULT_TRACE_COLUMN_PREFERENCES;
    }

    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? [...new Set(parsed.visibleColumns.filter(isTraceOptionalColumn))]
      : [...DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns];
    const customColumns = Array.isArray(parsed.customColumns)
      ? [...new Set(parsed.customColumns.filter(isTraceCustomColumn))]
      : [];

    return {
      visibleColumns,
      customColumns,
      metadataKeys: uniqueMetadataKeys(parsed.metadataKeys),
    };
  } catch {
    return DEFAULT_TRACE_COLUMN_PREFERENCES;
  }
}

export function serializeTraceColumnPreferences(preferences: TraceColumnPreferences): string {
  return JSON.stringify({
    version: TRACE_COLUMN_PREFERENCES_VERSION,
    visibleColumns: preferences.visibleColumns,
    customColumns: preferences.customColumns,
    metadataKeys: preferences.metadataKeys,
  });
}

export function buildTraceListColumns(preferences: TraceColumnPreferences): string {
  const visible = new Set(preferences.visibleColumns);
  // Name is bounded when Input is visible so Input (1fr) absorbs the free space;
  // without Input, Name is the flexible track that fills the grid.
  const columns = ['9rem'];

  if (visible.has('type')) columns.push('7rem');
  columns.push(visible.has('input') ? '14rem' : 'minmax(8rem,1fr)');
  if (visible.has('input')) columns.push('minmax(8rem,1fr)');

  columns.push('6rem');

  if (visible.has('duration')) columns.push('7rem');
  if (visible.has('endTime')) columns.push('8rem');
  if (visible.has('environment')) columns.push('8rem');
  if (visible.has('inputTokens')) columns.push('8rem');
  if (visible.has('outputTokens')) columns.push('8rem');
  if (visible.has('totalTokens')) columns.push('8rem');
  if (visible.has('estimatedCost')) columns.push('8rem');

  for (const _field of preferences.customColumns) {
    columns.push('minmax(8rem,14rem)');
  }

  for (const _key of preferences.metadataKeys) {
    columns.push('minmax(8rem,14rem)');
  }

  return columns.join(' ');
}

const RUN_PREFIX_PATTERN = /^(?:agent|workflow|scorer) run: '(.+?)'(.*)$/;

/** Core names root spans `agent run: 'id'` (+ optional ` (resumed)`); the Type column already carries
 *  the kind, so the list shows just the id and any suffix. Core names are untouched for exporters. */
export function displayTraceName<T extends string | null | undefined>(name: T): T {
  if (!name) return name;
  return name.replace(RUN_PREFIX_PATTERN, '$1$2') as T;
}

export function formatTraceMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, key)) return undefined;
  const value = metadata[key];
  if (value == null) return undefined;

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);

  try {
    return JSON.stringify(value) ?? undefined;
  } catch {
    return undefined;
  }
}

export function hasTraceColumn(preferences: TraceColumnPreferences, column: TraceOptionalColumn): boolean {
  return preferences.visibleColumns.includes(column);
}

export function hasTraceUsageColumn(preferences: TraceColumnPreferences): boolean {
  return preferences.visibleColumns.some(isTraceUsageColumn);
}

export function isTraceUsageColumn(column: TraceOptionalColumn): boolean {
  return TRACE_USAGE_COLUMN_SET.has(column);
}
