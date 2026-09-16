export const TRACE_OPTIONAL_COLUMNS = [
  'input',
  'entity',
  'duration',
  'inputTokens',
  'outputTokens',
  'estimatedCost',
] as const;

export type TraceOptionalColumn = (typeof TRACE_OPTIONAL_COLUMNS)[number];

export const TRACE_USAGE_COLUMNS = [
  'inputTokens',
  'outputTokens',
  'estimatedCost',
] as const satisfies readonly TraceOptionalColumn[];

export type TraceColumnPreferences = {
  readonly visibleColumns: readonly TraceOptionalColumn[];
  readonly metadataKeys: readonly string[];
};

export type TraceUsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  costUnit?: string;
};

export const DEFAULT_TRACE_COLUMN_PREFERENCES: TraceColumnPreferences = {
  visibleColumns: ['input', 'entity'],
  metadataKeys: [],
};

const TRACE_COLUMN_PREFERENCES_VERSION = 1;
const TRACE_COLUMN_SET = new Set<string>(TRACE_OPTIONAL_COLUMNS);
const TRACE_USAGE_COLUMN_SET = new Set<TraceOptionalColumn>(TRACE_USAGE_COLUMNS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTraceOptionalColumn(value: unknown): value is TraceOptionalColumn {
  return typeof value === 'string' && TRACE_COLUMN_SET.has(value);
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
    if (!isRecord(parsed) || parsed.version !== TRACE_COLUMN_PREFERENCES_VERSION) {
      return DEFAULT_TRACE_COLUMN_PREFERENCES;
    }

    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? [...new Set(parsed.visibleColumns.filter(isTraceOptionalColumn))]
      : [...DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns];

    return {
      visibleColumns,
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
    metadataKeys: preferences.metadataKeys,
  });
}

export function buildTraceListColumns(preferences: TraceColumnPreferences): string {
  const visible = new Set(preferences.visibleColumns);
  // Name is bounded when Input is visible so Input (1fr) absorbs the free space;
  // without Input, Name is the flexible track that fills the grid.
  const columns = ['11rem', visible.has('input') ? '14rem' : 'minmax(8rem,1fr)'];

  if (visible.has('input')) columns.push('minmax(8rem,1fr)');
  if (visible.has('entity')) columns.push('14rem');

  columns.push('6rem');

  if (visible.has('duration')) columns.push('7rem');
  if (visible.has('inputTokens')) columns.push('8rem');
  if (visible.has('outputTokens')) columns.push('8rem');
  if (visible.has('estimatedCost')) columns.push('8rem');

  for (const _key of preferences.metadataKeys) {
    columns.push('minmax(8rem,14rem)');
  }

  return columns.join(' ');
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
