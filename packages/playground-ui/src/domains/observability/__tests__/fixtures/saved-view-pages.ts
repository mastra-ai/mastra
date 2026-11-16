import type { SavedViewState } from '@mastra/core/storage';
import {
  writeObservabilityListDates,
  writeObservabilityListFilters,
  writeObservabilityListSort,
} from '../../observability-list-url-state';
import {
  LOGS_DATE_FROM_PARAM,
  LOGS_DATE_PRESET_PARAM,
  applyLogsPropertyFilterTokens,
} from '@/domains/logs/log-filters';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_TO_PARAM,
  TRACE_LIST_MODE_PARAM,
  applyTracePropertyFilterTokens,
} from '@/domains/traces/trace-filters';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import type { TraceFilterGroup, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import { SORT_DIR_PARAM, SORT_KEY_PARAM } from '@/lib/sort/use-url-sort';

/** Each page's view next to the URL the user gets by setting the same filters, range and sort by hand. */
export const FROM = '2026-10-01T00:00:00.000Z';
export const TO = '2026-10-02T12:30:00.000Z';

const traceTokens: TraceFilterToken[] = [
  { fieldId: 'status', value: 'error' },
  { fieldId: 'entityName', value: ['Weather Agent', 'Support Agent'], operatorId: 'in' },
  { fieldId: 'tags', value: ['prod'] },
  { fieldId: 'metadata.region', value: 'eu', operatorId: 'isNot' },
  { fieldId: 'spans.durationMs', value: '500', operatorId: 'gt' },
  { fieldId: 'threadId', value: '' },
];
const traceGroups: TraceFilterGroup[] = [
  {
    id: 'g1',
    logic: 'or',
    nodes: [
      { id: 't1', fieldId: 'environment', value: 'production' },
      {
        id: 'g2',
        logic: 'and',
        nodes: [{ id: 't2', fieldId: 'spans.name', value: 'weather', operatorId: 'matches' }],
      },
    ],
  },
];

// The by-hand URLs set filters, then the range, then the sort: the order applying a view writes them in.

/** The traces URL as the page writes it when the user sets these by hand. */
function tracesUrlByHand() {
  const params = new URLSearchParams('traceId=trace-1');
  applyTracePropertyFilterTokens(params, traceTokens, traceGroups);
  params.set(TRACE_DATE_PRESET_PARAM, 'custom');
  params.set(TRACE_DATE_FROM_PARAM, FROM);
  params.set(TRACE_DATE_TO_PARAM, TO);
  params.set(SORT_KEY_PARAM, 'timeToFirstChunkMs');
  params.set(SORT_DIR_PARAM, 'asc');
  params.set(TRACE_LIST_MODE_PARAM, 'branches');
  return params;
}

export const traceColumns: TraceColumnPreferences = {
  visibleColumns: ['type', 'input', 'duration', 'inputTokens'],
  customColumns: ['threadId'],
  metadataKeys: ['region'],
};

export const tracesView: SavedViewState = {
  schemaVersion: 1,
  page: 'traces',
  filters: [
    { fieldId: 'status', value: 'error' },
    { fieldId: 'entityName', value: ['Weather Agent', 'Support Agent'], operatorId: 'in' },
    { fieldId: 'tags', value: ['prod'] },
    { fieldId: 'metadata.region', value: 'eu', operatorId: 'isNot' },
    { fieldId: 'spans.durationMs', value: '500', operatorId: 'gt' },
    { fieldId: 'threadId', value: '' },
    ...traceGroups,
  ],
  dateRange: { from: FROM, to: TO },
  sort: { field: 'timeToFirstChunkMs', direction: 'asc' },
  columns: [
    { id: 'type', visible: true },
    { id: 'input', visible: true },
    { id: 'output', visible: false },
    { id: 'duration', visible: true },
    { id: 'timeToFirstChunk', visible: false },
    { id: 'timeToFirstToken', visible: false },
    { id: 'endTime', visible: false },
    { id: 'environment', visible: false },
    { id: 'inputTokens', visible: true },
    { id: 'outputTokens', visible: false },
    { id: 'totalTokens', visible: false },
    { id: 'estimatedCost', visible: false },
    { id: 'custom.threadId', visible: true },
    { id: 'custom.traceId', visible: false },
    { id: 'custom.resourceId', visible: false },
    { id: 'custom.entityId', visible: false },
    { id: 'metadata.region', visible: true },
  ],
  options: { listMode: 'branches' },
};

const listTokens: TraceFilterToken[] = [
  { fieldId: 'spanType', value: 'tool_call' },
  { fieldId: 'entityName', value: ['Weather Agent'], operatorId: 'in' },
  { fieldId: 'durationMs', value: '100', operatorId: 'gte' },
  { fieldId: 'environment', value: '', operatorId: 'exists' },
];
export const listGroups: TraceFilterGroup[] = [
  { id: 'g1', logic: 'or', nodes: [{ id: 't1', fieldId: 'status', value: 'error' }] },
];

/** The spans / threads URL as the page writes it when the user sets these by hand. */
function listUrlByHand(tokens: TraceFilterToken[], groups: TraceFilterGroup[]) {
  const params = new URLSearchParams('spanId=span-1');
  writeObservabilityListFilters(params, { tokens, groups });
  writeObservabilityListDates(params, { datePreset: 'last-24h' });
  writeObservabilityListSort(params, { field: 'startedAt', direction: 'asc' });
  return params;
}

export const spansView: SavedViewState = {
  schemaVersion: 1,
  page: 'spans',
  filters: [...listTokens, ...listGroups],
  dateRange: { preset: 'last-24h' },
  sort: { field: 'startedAt', direction: 'asc' },
};

const threadTokens: TraceFilterToken[] = [
  { fieldId: 'traceCount', value: '3', operatorId: 'gt' },
  { fieldId: 'resourceId', value: 'user-1' },
];
export const threadsView: SavedViewState = {
  schemaVersion: 1,
  page: 'threads',
  filters: [...threadTokens, ...listGroups],
  dateRange: { preset: 'last-24h' },
  sort: { field: 'startedAt', direction: 'asc' },
};

/** The logs URL as the page writes it when the user sets these by hand. */
function logsUrlByHand() {
  const params = new URLSearchParams('logId=log-1');
  applyLogsPropertyFilterTokens(params, [
    { fieldId: 'rootEntityType', value: 'agent' },
    { fieldId: 'level', value: 'error' },
    { fieldId: 'tags', value: [] },
  ]);
  params.set(LOGS_DATE_PRESET_PARAM, 'custom');
  params.set(LOGS_DATE_FROM_PARAM, FROM);
  params.set(SORT_KEY_PARAM, 'timestamp');
  params.set(SORT_DIR_PARAM, 'asc');
  return params;
}

export const logsView: SavedViewState = {
  schemaVersion: 1,
  page: 'logs',
  filters: [
    { fieldId: 'rootEntityType', value: 'agent' },
    { fieldId: 'level', value: 'error' },
    { fieldId: 'tags', value: [] },
  ],
  dateRange: { from: FROM },
  sort: { field: 'timestamp', direction: 'asc' },
};

export const pages = [
  {
    page: 'traces',
    url: tracesUrlByHand,
    base: 'traceId=trace-1',
    view: tracesView,
    columns: traceColumns,
  },
  { page: 'spans', url: () => listUrlByHand(listTokens, listGroups), base: 'spanId=span-1', view: spansView },
  { page: 'threads', url: () => listUrlByHand(threadTokens, listGroups), base: 'spanId=span-1', view: threadsView },
  { page: 'logs', url: logsUrlByHand, base: 'logId=log-1', view: logsView },
] as const;
