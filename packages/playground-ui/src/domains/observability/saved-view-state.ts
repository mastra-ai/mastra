/**
 * Conversion between a saved view (`SavedViewState` from `@mastra/core/storage`) and the URL state of
 * the observability list pages. Applying a view writes the URL the user would get by setting the same
 * filters, range, sort and options by hand, through each page's own URL writers.
 *
 * Columns are not URL state (traces and spans keep them in local storage), so they travel separately
 * as `TraceColumnPreferences`.
 */
import type {
  FilterGroup,
  FilterNode,
  FilterToken,
  SavedViewColumn,
  SavedViewDateRange,
  SavedViewPage,
  SavedViewSort,
  SavedViewState,
} from '@mastra/core/storage';
import {
  readObservabilityListFilters,
  writeObservabilityListFilters,
  OBSERVABILITY_LIST_DEFAULT_DATE_PRESET,
  OBSERVABILITY_LIST_SORT_FIELDS,
  SPAN_LIST_SORT_FIELDS,
} from './observability-list-url-state';
import {
  DEFAULT_LOGS_DATE_PRESET,
  LOGS_DATE_PRESET_VALUES,
  LOGS_PROPERTY_FILTER_FIELD_IDS,
  LOGS_ROOT_ENTITY_TYPE_PARAM,
  LOGS_SORT_FIELDS,
  applyLogsPropertyFilterTokens,
  getLogsPropertyFilterTokens,
} from '@/domains/logs/log-filters';
import {
  SPAN_CONTEXT_FILTER_FIELD_IDS,
  SPAN_CORE_FILTER_FIELD_IDS,
  createSpanFilterBarFields,
} from '@/domains/spans/span-filters';
import { THREAD_FILTER_FIELD_IDS, createThreadFilterBarFields } from '@/domains/threads/thread-filters';
import {
  DEFAULT_TRACES_FILTERS,
  TRACES_SORT_FIELDS,
} from '@/domains/traces/components/traces-explorer/traces-explorer-actions';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  TRACE_LIST_MODE_PARAM,
  TRACE_LIST_MODE_VALUES,
  TRACE_PROPERTY_FILTER_FIELD_IDS,
  TRACE_STRING_OPERATORS,
  TRACE_SYNTHETIC_FILTER_FIELD_IDS,
  TRACE_TAGS_OPERATORS,
  applyTracePropertyFilterTokens,
  createTraceFilterBarFields,
  getTraceFilterGroups,
  getTracePropertyFilterTokens,
  isTraceMetadataFieldId,
} from '@/domains/traces/trace-filters';
import type { TraceListMode } from '@/domains/traces/trace-filters';
import {
  TRACE_COLUMN_CATALOGS,
  TRACE_CUSTOM_COLUMN_FIELDS,
  TRACE_USAGE_COLUMNS,
  isTraceCustomColumn,
} from '@/domains/traces/trace-list-columns';
import type {
  TraceColumnPreferences,
  TraceColumnScope,
  TraceCustomColumn,
  TraceOptionalColumn,
} from '@/domains/traces/trace-list-columns';
import { isTraceFilterGroup, isTraceFilterOperatorId } from '@/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterNode, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import { SORT_DIR_PARAM, SORT_KEY_PARAM, readUrlSort } from '@/lib/sort/use-url-sort';

const PAGE_PARAM = 'page';
export const SAVED_VIEW_CUSTOM_COLUMN_PREFIX = 'custom.';
export const SAVED_VIEW_METADATA_COLUMN_PREFIX = 'metadata.';

const isGroup = (node: FilterNode): node is FilterGroup => 'nodes' in node;

type PageSpec = {
  readFilters: (params: URLSearchParams) => FilterNode[];
  writeFilters: (params: URLSearchParams, tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
  /** Whether a token is one the page can still show and run: a known field, with an operator it allows. */
  acceptsToken: (token: FilterToken) => boolean;
  groups: boolean;
  defaultDatePreset: string;
  datePresets: ReadonlySet<string>;
  sortFields: readonly string[];
  columns?: TraceColumnScope;
  readOptions: (params: URLSearchParams) => Record<string, unknown>;
  /** Mutates `params`: writes the options the page knows, clears the rest. */
  writeOptions: (params: URLSearchParams, options: Record<string, unknown>) => void;
};

/**
 * `operators` maps a field to the operators the filter bar offers for it. A token without an explicit
 * operator is a chip still being edited (or on its default operator) and is accepted on a known field.
 */
const acceptsWith =
  (isKnownField: (fieldId: string) => boolean, operators: (fieldId: string) => readonly string[] | undefined) =>
  (token: FilterToken) => {
    if (!isKnownField(token.fieldId)) return false;
    if (token.operatorId === undefined) return true;
    const allowed = operators(token.fieldId);
    return !allowed || allowed.includes(token.operatorId);
  };

const operatorsByField = (fields: readonly { id: string; operators?: string[] }[]) =>
  new Map(fields.map(field => [field.id, field.operators]));

const noOptions = {
  readOptions: () => ({}),
  writeOptions: () => {},
};

const splitNodes = (nodes: TraceFilterNode[]) => ({
  tokens: nodes.filter((node): node is TraceFilterToken => !isTraceFilterGroup(node)),
  groups: nodes.filter(isTraceFilterGroup),
});

// The widest field set each page can offer (every server capability on); the page's own query
// builder still leaves out what the connected server can't run.
const TRACE_FIELD_OPERATORS = operatorsByField([
  ...createTraceFilterBarFields({
    availableRootEntityNames: [],
    availableEnvironments: [],
    withRootDuration: true,
    withTimeToFirstChunk: true,
    withTimeToFirstToken: true,
  }),
  { id: 'tags', operators: TRACE_TAGS_OPERATORS },
]);
const TRACE_URL_FIELD_IDS = new Set<string>([...TRACE_SYNTHETIC_FILTER_FIELD_IDS, ...TRACE_PROPERTY_FILTER_FIELD_IDS]);

const SPAN_FIELD_IDS = new Set<string>([...SPAN_CORE_FILTER_FIELD_IDS, ...SPAN_CONTEXT_FILTER_FIELD_IDS]);
const SPAN_FIELD_OPERATORS = operatorsByField(
  createSpanFilterBarFields({
    withContextFields: true,
    withTimeToFirstChunk: true,
    withTimeToFirstToken: true,
    entityNames: [],
    environments: [],
  }),
);

const THREAD_FIELD_IDS = new Set<string>(THREAD_FILTER_FIELD_IDS);
const THREAD_FIELD_OPERATORS = operatorsByField(
  createThreadFilterBarFields({
    withTimeToFirstChunk: true,
    withTimeToFirstToken: true,
    entityNames: [],
    environments: [],
  }),
);

const LOGS_FIELD_IDS = new Set<string>([LOGS_ROOT_ENTITY_TYPE_PARAM, ...LOGS_PROPERTY_FILTER_FIELD_IDS]);
/** Fields the logs URL stores as repeated params; every other logs field holds one string. */
const LOGS_ARRAY_FIELD_IDS = new Set(['tags']);

const observabilityListFilters = {
  readFilters: (params: URLSearchParams): FilterNode[] => {
    const { tokens, groups } = readObservabilityListFilters(params);
    return [...tokens, ...groups];
  },
  writeFilters: (params: URLSearchParams, tokens: TraceFilterToken[], groups: TraceFilterGroup[]) =>
    writeObservabilityListFilters(params, { tokens, groups }),
  groups: true,
  defaultDatePreset: OBSERVABILITY_LIST_DEFAULT_DATE_PRESET,
  datePresets: TRACE_DATE_PRESET_VALUES,
  sortFields: OBSERVABILITY_LIST_SORT_FIELDS,
};

const PAGE_SPECS: Record<SavedViewPage, PageSpec> = {
  traces: {
    readFilters: params => [...getTracePropertyFilterTokens(params), ...getTraceFilterGroups(params)],
    writeFilters: applyTracePropertyFilterTokens,
    acceptsToken: acceptsWith(
      fieldId => TRACE_URL_FIELD_IDS.has(fieldId) || isTraceMetadataFieldId(fieldId),
      fieldId => (isTraceMetadataFieldId(fieldId) ? TRACE_STRING_OPERATORS : TRACE_FIELD_OPERATORS.get(fieldId)),
    ),
    groups: true,
    defaultDatePreset: DEFAULT_TRACES_FILTERS.datePreset,
    // The traces page reads `all` as its default range.
    datePresets: new Set([...TRACE_DATE_PRESET_VALUES].filter(preset => preset !== 'all')),
    sortFields: TRACES_SORT_FIELDS,
    columns: 'traces',
    readOptions: params => {
      const listMode = params.get(TRACE_LIST_MODE_PARAM);
      return listMode && TRACE_LIST_MODE_VALUES.has(listMode as TraceListMode) ? { listMode } : {};
    },
    writeOptions: (params, options) => {
      const { listMode } = options;
      if (typeof listMode === 'string' && TRACE_LIST_MODE_VALUES.has(listMode as TraceListMode)) {
        params.set(TRACE_LIST_MODE_PARAM, listMode);
      } else {
        params.delete(TRACE_LIST_MODE_PARAM);
      }
    },
  },
  spans: {
    ...observabilityListFilters,
    ...noOptions,
    sortFields: SPAN_LIST_SORT_FIELDS,
    acceptsToken: acceptsWith(
      fieldId => SPAN_FIELD_IDS.has(fieldId),
      fieldId => SPAN_FIELD_OPERATORS.get(fieldId),
    ),
    columns: 'spans',
  },
  threads: {
    ...observabilityListFilters,
    ...noOptions,
    acceptsToken: acceptsWith(
      fieldId => THREAD_FIELD_IDS.has(fieldId),
      fieldId => THREAD_FIELD_OPERATORS.get(fieldId),
    ),
    columns: 'threads',
  },
  logs: {
    readFilters: getLogsPropertyFilterTokens,
    writeFilters: (params, tokens) => applyLogsPropertyFilterTokens(params, tokens),
    // The logs URL has no operator params: only a field's implicit operator and value shape round-trip.
    acceptsToken: ({ fieldId, value, operatorId }) => {
      if (!LOGS_FIELD_IDS.has(fieldId)) return false;
      const many = LOGS_ARRAY_FIELD_IDS.has(fieldId);
      if (Array.isArray(value) !== many) return false;
      return operatorId === undefined || operatorId === (many ? 'in' : 'is');
    },
    groups: false,
    defaultDatePreset: DEFAULT_LOGS_DATE_PRESET,
    datePresets: LOGS_DATE_PRESET_VALUES,
    sortFields: LOGS_SORT_FIELDS,
    ...noOptions,
  },
};

/** A saved operator id may come from a newer page or a dashboard; the filter bar can't show one it doesn't know. */
const hasKnownOperator = (token: FilterToken): token is TraceFilterToken =>
  token.operatorId === undefined || isTraceFilterOperatorId(token.operatorId);

/**
 * Drops the nodes the page can't apply, each on its own. A group emptied that way is dropped too; one
 * saved empty is kept.
 */
function keepApplicable(nodes: FilterNode[], spec: PageSpec): TraceFilterNode[] {
  return nodes.flatMap((node): TraceFilterNode[] => {
    if (!isGroup(node)) return hasKnownOperator(node) && spec.acceptsToken(node) ? [node] : [];
    if (!spec.groups) return [];
    const kept = keepApplicable(node.nodes, spec);
    return kept.length === 0 && node.nodes.length > 0 ? [] : [{ ...node, nodes: kept }];
  });
}

function readDateRange(params: URLSearchParams, spec: PageSpec): SavedViewDateRange | undefined {
  const preset = params.get(TRACE_DATE_PRESET_PARAM);
  if (!preset || !spec.datePresets.has(preset)) return undefined;
  if (preset !== 'custom') return { preset };
  const from = toIsoDate(params.get(TRACE_DATE_FROM_PARAM));
  if (!from) return undefined;
  const to = toIsoDate(params.get(TRACE_DATE_TO_PARAM));
  return to ? { from, to } : { from };
}

function writeDateRange(
  params: URLSearchParams,
  spec: PageSpec,
  range: SavedViewDateRange | undefined,
  defaultDatePreset: string,
) {
  params.delete(TRACE_DATE_PRESET_PARAM);
  params.delete(TRACE_DATE_FROM_PARAM);
  params.delete(TRACE_DATE_TO_PARAM);
  if (!range) return;
  if ('preset' in range) {
    if (range.preset !== 'custom' && range.preset !== defaultDatePreset && spec.datePresets.has(range.preset)) {
      params.set(TRACE_DATE_PRESET_PARAM, range.preset);
    }
    return;
  }
  const from = toIsoDate(range.from);
  if (!from) return;
  params.set(TRACE_DATE_PRESET_PARAM, 'custom');
  params.set(TRACE_DATE_FROM_PARAM, from);
  const to = toIsoDate(range.to ?? null);
  if (to) params.set(TRACE_DATE_TO_PARAM, to);
}

/** The pages write dates with `toISOString()`, so a view's dates are normalized the same way. */
function toIsoDate(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readSort(params: URLSearchParams, spec: PageSpec): SavedViewSort | undefined {
  const sort = readUrlSort(params, spec.sortFields);
  return sort ? { field: sort.key, direction: sort.direction } : undefined;
}

function writeSort(params: URLSearchParams, spec: PageSpec, sort: SavedViewSort | undefined) {
  if (sort && spec.sortFields.includes(sort.field)) {
    params.set(SORT_KEY_PARAM, sort.field);
    params.set(SORT_DIR_PARAM, sort.direction);
  } else {
    params.delete(SORT_KEY_PARAM);
    params.delete(SORT_DIR_PARAM);
  }
}

const standardColumns = (scope: TraceColumnScope): readonly TraceOptionalColumn[] => {
  const catalog = TRACE_COLUMN_CATALOGS[scope];
  return catalog.usage ? [...catalog.standardColumns, ...TRACE_USAGE_COLUMNS] : catalog.standardColumns;
};

/**
 * A page's column preferences as saved-view columns: every standard column in catalog order with its
 * visibility, then the custom columns (shown ones first, in their order) and the metadata columns.
 */
export function savedViewColumnsFromPreferences(
  scope: TraceColumnScope,
  preferences: TraceColumnPreferences,
): SavedViewColumn[] {
  const visible = new Set(preferences.visibleColumns);
  const shownCustom = new Set<string>(preferences.customColumns);
  return [
    ...standardColumns(scope).map(id => ({ id, visible: visible.has(id) })),
    ...preferences.customColumns.map(field => ({ id: SAVED_VIEW_CUSTOM_COLUMN_PREFIX + field, visible: true })),
    ...TRACE_CUSTOM_COLUMN_FIELDS.filter(field => !shownCustom.has(field)).map(field => ({
      id: SAVED_VIEW_CUSTOM_COLUMN_PREFIX + field,
      visible: false,
    })),
    ...(TRACE_COLUMN_CATALOGS[scope].metadata
      ? preferences.metadataKeys.map(key => ({ id: SAVED_VIEW_METADATA_COLUMN_PREFIX + key, visible: true }))
      : []),
  ];
}

/** Saved-view columns as a page's column preferences. Columns the page no longer offers are dropped. */
export function columnPreferencesFromSavedView(
  scope: TraceColumnScope,
  columns: readonly SavedViewColumn[],
): TraceColumnPreferences {
  const standard = new Set<string>(standardColumns(scope));
  const visibleColumns: TraceOptionalColumn[] = [];
  const customColumns: TraceCustomColumn[] = [];
  const metadataKeys: string[] = [];
  for (const { id, visible } of columns) {
    if (!visible) continue;
    if (standard.has(id)) {
      visibleColumns.push(id as TraceOptionalColumn);
    } else if (id.startsWith(SAVED_VIEW_CUSTOM_COLUMN_PREFIX)) {
      const field = id.slice(SAVED_VIEW_CUSTOM_COLUMN_PREFIX.length);
      if (isTraceCustomColumn(field)) customColumns.push(field);
    } else if (id.startsWith(SAVED_VIEW_METADATA_COLUMN_PREFIX) && TRACE_COLUMN_CATALOGS[scope].metadata) {
      const key = id.slice(SAVED_VIEW_METADATA_COLUMN_PREFIX.length).trim();
      if (key) metadataKeys.push(key);
    }
  }
  return { visibleColumns, customColumns, metadataKeys };
}

/**
 * The saved view of `page` for its current URL. Pass the page's column preferences to save its
 * columns too (traces, spans and threads only; the other pages have fixed columns).
 */
export function savedViewFromSearchParams(
  page: SavedViewPage,
  params: URLSearchParams,
  { columns }: { columns?: TraceColumnPreferences } = {},
): SavedViewState {
  const spec = PAGE_SPECS[page];
  const dateRange = readDateRange(params, spec);
  const sort = readSort(params, spec);
  const options = spec.readOptions(params);
  return {
    schemaVersion: 1,
    page,
    filters: spec.readFilters(params),
    ...(dateRange ? { dateRange } : {}),
    ...(sort ? { sort } : {}),
    ...(columns && spec.columns ? { columns: savedViewColumnsFromPreferences(spec.columns, columns) } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
}

export type AppliedSavedView = {
  /** `base` with the view's filters, range, sort and options in place of the page's own. */
  params: URLSearchParams;
  /** The column preferences to apply; set only when the view has columns and the page offers a column picker. */
  columns?: TraceColumnPreferences;
};

export type ApplySavedViewOptions = {
  /**
   * The range the host shows when the URL names none, when it differs from the page's own default.
   * Only this preset is left out of the URL; any other one, including the page's default, is written.
   */
  defaultDatePreset?: string;
};

/**
 * Applies `view` on top of `base` (the page's current search params): every view param is replaced,
 * other params (e.g. the open row) are kept and the list restarts at its first page. Parts of the view
 * the page no longer supports (unknown filter field or operator, sort field, date preset, column,
 * option) are dropped one by one; the page's default takes their place.
 */
export function applySavedView(
  view: SavedViewState,
  base: URLSearchParams,
  { defaultDatePreset }: ApplySavedViewOptions = {},
): AppliedSavedView {
  const spec = PAGE_SPECS[view.page];
  const params = new URLSearchParams(base);
  const { tokens, groups } = splitNodes(keepApplicable(view.filters, spec));
  spec.writeFilters(params, tokens, groups);
  writeDateRange(params, spec, view.dateRange, defaultDatePreset ?? spec.defaultDatePreset);
  writeSort(params, spec, view.sort);
  spec.writeOptions(params, view.options ?? {});
  params.delete(PAGE_PARAM);
  return {
    params,
    ...(view.columns && spec.columns ? { columns: columnPreferencesFromSavedView(spec.columns, view.columns) } : {}),
  };
}
