export const TRACE_OPTIONAL_COLUMNS = [
  'type',
  'input',
  'output',
  'duration',
  'timeToFirstChunk',
  'endTime',
  'environment',
  'model',
  'provider',
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
export const TRACE_CUSTOM_COLUMN_FIELDS = ['traceId', 'threadId', 'resourceId', 'entityId'] as const;

export type TraceCustomColumn = (typeof TRACE_CUSTOM_COLUMN_FIELDS)[number];

export const TRACE_CUSTOM_COLUMN_LABELS: Record<TraceCustomColumn, string> = {
  traceId: 'Trace ID',
  threadId: 'Thread ID',
  resourceId: 'Resource ID',
  entityId: 'Primitive ID',
};

export type TraceColumnPreferences = {
  readonly visibleColumns: readonly TraceOptionalColumn[];
  readonly customColumns: readonly TraceCustomColumn[];
  readonly metadataKeys: readonly string[];
};

import type { TraceUsageSummary } from '@mastra/react/hooks/traces';
export type { TraceUsageSummary };

export const DEFAULT_TRACE_COLUMN_PREFERENCES: TraceColumnPreferences = {
  visibleColumns: ['type', 'input', 'output', 'duration', 'estimatedCost'],
  customColumns: [],
  metadataKeys: [],
};

/** A list a column selection belongs to. Each list only offers the columns its rows carry. */
export type TraceColumnScope = 'traces' | 'spans';

export type TraceColumnCatalog = {
  /** Plain columns offered in the picker, in menu order. */
  readonly standardColumns: readonly TraceOptionalColumn[];
  /** Whether rows carry token and cost usage. */
  readonly usage: boolean;
  /** Whether rows carry metadata that can be shown as columns. */
  readonly metadata: boolean;
  readonly defaults: TraceColumnPreferences;
};

export const TRACE_COLUMN_CATALOGS: Record<TraceColumnScope, TraceColumnCatalog> = {
  traces: {
    standardColumns: ['type', 'input', 'output', 'duration', 'timeToFirstChunk', 'endTime', 'environment'],
    usage: true,
    metadata: true,
    defaults: DEFAULT_TRACE_COLUMN_PREFERENCES,
  },
  spans: {
    standardColumns: ['type', 'input', 'output', 'duration', 'endTime', 'environment', 'model', 'provider'],
    usage: false,
    metadata: false,
    defaults: { visibleColumns: ['type', 'input', 'output', 'duration'], customColumns: [], metadataKeys: [] },
  },
};

// v2: 'entity' became 'type' and moved before Name; duration + cost joined the defaults.
// v3: added `customColumns`; a v2 payload is migrated rather than reset.
// v4: added 'output', shown after 'input' for anyone who had Input visible.
const TRACE_COLUMN_PREFERENCES_VERSION = 4;
const TRACE_COLUMN_PREFERENCES_MIGRATABLE_VERSIONS = new Set<unknown>([2, 3, TRACE_COLUMN_PREFERENCES_VERSION]);
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

export function parseTraceColumnPreferences(
  serialized: string | undefined,
  defaults: TraceColumnPreferences = DEFAULT_TRACE_COLUMN_PREFERENCES,
): TraceColumnPreferences {
  if (!serialized) return defaults;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || !TRACE_COLUMN_PREFERENCES_MIGRATABLE_VERSIONS.has(parsed.version)) {
      return defaults;
    }

    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? [...new Set(parsed.visibleColumns.filter(isTraceOptionalColumn))]
      : [...defaults.visibleColumns];
    if (parsed.version !== TRACE_COLUMN_PREFERENCES_VERSION && !visibleColumns.includes('output')) {
      const input = visibleColumns.indexOf('input');
      if (input !== -1) visibleColumns.splice(input + 1, 0, 'output');
    }
    const customColumns = Array.isArray(parsed.customColumns)
      ? [...new Set(parsed.customColumns.filter(isTraceCustomColumn))]
      : [];

    return {
      visibleColumns,
      customColumns,
      metadataKeys: uniqueMetadataKeys(parsed.metadataKeys),
    };
  } catch {
    return defaults;
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

/** Stable key per column of `buildTraceListColumns`, in the same order. Used to persist the column order. */
export function buildTraceListColumnKeys(preferences: TraceColumnPreferences): string[] {
  const visible = new Set(preferences.visibleColumns);
  const keys = ['startTime'];
  if (visible.has('type')) keys.push('type');
  keys.push('name');
  if (visible.has('input')) keys.push('input');
  if (visible.has('output')) keys.push('output');
  keys.push('status');
  for (const column of [
    'duration',
    'timeToFirstChunk',
    'endTime',
    'environment',
    'model',
    'provider',
    ...TRACE_USAGE_COLUMNS,
  ] as const) {
    if (visible.has(column)) keys.push(column);
  }
  keys.push(...preferences.customColumns.map(field => `custom:${field}`));
  keys.push(...preferences.metadataKeys.map(key => `metadata:${key}`));
  return keys;
}

export function buildTraceListColumns(preferences: TraceColumnPreferences): string {
  const visible = new Set(preferences.visibleColumns);
  // Name is bounded when Input or Output is visible so they (1fr each) absorb the free space;
  // without either, Name is the flexible track that fills the grid.
  const columns = ['11rem'];
  const hasPreview = visible.has('input') || visible.has('output');

  if (visible.has('type')) columns.push('7rem');
  columns.push(hasPreview ? '14rem' : 'minmax(8rem,1fr)');
  if (visible.has('input')) columns.push('minmax(8rem,1fr)');
  if (visible.has('output')) columns.push('minmax(8rem,1fr)');

  columns.push('6rem');

  if (visible.has('duration')) columns.push('7rem');
  if (visible.has('timeToFirstChunk')) columns.push('7rem');
  if (visible.has('endTime')) columns.push('11rem');
  if (visible.has('environment')) columns.push('8rem');
  if (visible.has('model')) columns.push('10rem');
  if (visible.has('provider')) columns.push('8rem');
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

/** Core names root spans `agent run: 'id'` (+ optional ` (resumed)`); the Primitive type column already carries
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

export function toggleTraceColumn(
  preferences: TraceColumnPreferences,
  column: TraceOptionalColumn,
): TraceColumnPreferences {
  return {
    ...preferences,
    visibleColumns: preferences.visibleColumns.includes(column)
      ? preferences.visibleColumns.filter(visibleColumn => visibleColumn !== column)
      : [...preferences.visibleColumns, column],
  };
}

export function addTraceCustomColumn(
  preferences: TraceColumnPreferences,
  field: TraceCustomColumn,
): TraceColumnPreferences {
  if (preferences.customColumns.includes(field)) return preferences;
  return { ...preferences, customColumns: [...preferences.customColumns, field] };
}

export function removeTraceCustomColumn(
  preferences: TraceColumnPreferences,
  field: TraceCustomColumn,
): TraceColumnPreferences {
  return { ...preferences, customColumns: preferences.customColumns.filter(customColumn => customColumn !== field) };
}

export function addTraceMetadataColumn(preferences: TraceColumnPreferences, key: string): TraceColumnPreferences {
  const normalizedKey = key.trim();
  if (!normalizedKey || preferences.metadataKeys.includes(normalizedKey)) return preferences;
  return { ...preferences, metadataKeys: [...preferences.metadataKeys, normalizedKey] };
}

export function removeTraceMetadataColumn(preferences: TraceColumnPreferences, key: string): TraceColumnPreferences {
  return { ...preferences, metadataKeys: preferences.metadataKeys.filter(metadataKey => metadataKey !== key) };
}

export function hasTraceUsageColumn(preferences: TraceColumnPreferences): boolean {
  return preferences.visibleColumns.some(isTraceUsageColumn);
}

export function isTraceUsageColumn(column: TraceOptionalColumn): boolean {
  return TRACE_USAGE_COLUMN_SET.has(column);
}
