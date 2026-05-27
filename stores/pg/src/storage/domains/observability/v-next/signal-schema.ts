type ColumnType = 'bigserial' | 'boolean' | 'double precision' | 'jsonb' | 'text' | 'text[]' | 'timestamptz';

interface SignalColumn {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  defaultSql?: string;
}

const CURSOR_ID_COLUMN = { name: 'cursorId', type: 'bigserial' } as const satisfies SignalColumn;

const COMMON_CONTEXT_COLUMNS = [
  { name: 'traceId', type: 'text', nullable: true },
  { name: 'spanId', type: 'text', nullable: true },
  { name: 'experimentId', type: 'text', nullable: true },
  { name: 'entityType', type: 'text', nullable: true },
  { name: 'entityId', type: 'text', nullable: true },
  { name: 'entityName', type: 'text', nullable: true },
  { name: 'entityVersionId', type: 'text', nullable: true },
  { name: 'parentEntityType', type: 'text', nullable: true },
  { name: 'parentEntityId', type: 'text', nullable: true },
  { name: 'parentEntityName', type: 'text', nullable: true },
  { name: 'parentEntityVersionId', type: 'text', nullable: true },
  { name: 'rootEntityType', type: 'text', nullable: true },
  { name: 'rootEntityId', type: 'text', nullable: true },
  { name: 'rootEntityName', type: 'text', nullable: true },
  { name: 'rootEntityVersionId', type: 'text', nullable: true },
  { name: 'userId', type: 'text', nullable: true },
  { name: 'organizationId', type: 'text', nullable: true },
  { name: 'resourceId', type: 'text', nullable: true },
  { name: 'runId', type: 'text', nullable: true },
  { name: 'sessionId', type: 'text', nullable: true },
  { name: 'threadId', type: 'text', nullable: true },
  { name: 'requestId', type: 'text', nullable: true },
  { name: 'environment', type: 'text', nullable: true },
  { name: 'executionSource', type: 'text', nullable: true },
  { name: 'serviceName', type: 'text', nullable: true },
] as const satisfies readonly SignalColumn[];

export const SPAN_EVENT_COLUMNS = [
  CURSOR_ID_COLUMN,
  { name: 'traceId', type: 'text' },
  { name: 'spanId', type: 'text' },
  { name: 'parentSpanId', type: 'text', nullable: true },
  { name: 'experimentId', type: 'text', nullable: true },
  { name: 'entityType', type: 'text', nullable: true },
  { name: 'entityId', type: 'text', nullable: true },
  { name: 'entityName', type: 'text', nullable: true },
  { name: 'entityVersionId', type: 'text', nullable: true },
  { name: 'parentEntityType', type: 'text', nullable: true },
  { name: 'parentEntityId', type: 'text', nullable: true },
  { name: 'parentEntityName', type: 'text', nullable: true },
  { name: 'parentEntityVersionId', type: 'text', nullable: true },
  { name: 'rootEntityType', type: 'text', nullable: true },
  { name: 'rootEntityId', type: 'text', nullable: true },
  { name: 'rootEntityName', type: 'text', nullable: true },
  { name: 'rootEntityVersionId', type: 'text', nullable: true },
  { name: 'userId', type: 'text', nullable: true },
  { name: 'organizationId', type: 'text', nullable: true },
  { name: 'resourceId', type: 'text', nullable: true },
  { name: 'runId', type: 'text', nullable: true },
  { name: 'sessionId', type: 'text', nullable: true },
  { name: 'threadId', type: 'text', nullable: true },
  { name: 'requestId', type: 'text', nullable: true },
  { name: 'environment', type: 'text', nullable: true },
  { name: 'executionSource', type: 'text', nullable: true },
  { name: 'serviceName', type: 'text', nullable: true },
  { name: 'name', type: 'text' },
  { name: 'spanType', type: 'text' },
  { name: 'isEvent', type: 'boolean', defaultSql: 'false' },
  { name: 'startedAt', type: 'timestamptz' },
  { name: 'endedAt', type: 'timestamptz' },
  { name: 'tags', type: 'text[]', defaultSql: "'{}'" },
  { name: 'metadataSearch', type: 'jsonb', defaultSql: "'{}'::jsonb" },
  { name: 'attributes', type: 'jsonb', nullable: true },
  { name: 'scope', type: 'jsonb', nullable: true },
  { name: 'links', type: 'jsonb', nullable: true },
  { name: 'input', type: 'jsonb', nullable: true },
  { name: 'output', type: 'jsonb', nullable: true },
  { name: 'error', type: 'jsonb', nullable: true },
  { name: 'metadataRaw', type: 'jsonb', nullable: true },
  { name: 'requestContext', type: 'jsonb', nullable: true },
] as const satisfies readonly SignalColumn[];

export const METRIC_EVENT_COLUMNS = [
  CURSOR_ID_COLUMN,
  { name: 'metricId', type: 'text' },
  { name: 'timestamp', type: 'timestamptz' },
  { name: 'name', type: 'text' },
  { name: 'value', type: 'double precision' },
  ...COMMON_CONTEXT_COLUMNS,
  { name: 'provider', type: 'text', nullable: true },
  { name: 'model', type: 'text', nullable: true },
  { name: 'estimatedCost', type: 'double precision', nullable: true },
  { name: 'costUnit', type: 'text', nullable: true },
  { name: 'tags', type: 'text[]', defaultSql: "'{}'" },
  { name: 'labels', type: 'jsonb', defaultSql: "'{}'::jsonb" },
  { name: 'costMetadata', type: 'jsonb', nullable: true },
  { name: 'metadata', type: 'jsonb', nullable: true },
  { name: 'scope', type: 'jsonb', nullable: true },
] as const satisfies readonly SignalColumn[];

export const LOG_EVENT_COLUMNS = [
  CURSOR_ID_COLUMN,
  { name: 'logId', type: 'text' },
  { name: 'timestamp', type: 'timestamptz' },
  { name: 'level', type: 'text' },
  { name: 'message', type: 'text' },
  ...COMMON_CONTEXT_COLUMNS,
  { name: 'tags', type: 'text[]', defaultSql: "'{}'" },
  { name: 'data', type: 'jsonb', nullable: true },
  { name: 'metadata', type: 'jsonb', nullable: true },
  { name: 'scope', type: 'jsonb', nullable: true },
] as const satisfies readonly SignalColumn[];

export const SCORE_EVENT_COLUMNS = [
  CURSOR_ID_COLUMN,
  { name: 'scoreId', type: 'text' },
  { name: 'timestamp', type: 'timestamptz' },
  { name: 'scorerId', type: 'text' },
  { name: 'scorerVersion', type: 'text', nullable: true },
  { name: 'scoreSource', type: 'text', nullable: true },
  { name: 'score', type: 'double precision' },
  { name: 'reason', type: 'text', nullable: true },
  ...COMMON_CONTEXT_COLUMNS,
  { name: 'scoreTraceId', type: 'text', nullable: true },
  { name: 'tags', type: 'text[]', defaultSql: "'{}'" },
  { name: 'metadata', type: 'jsonb', nullable: true },
  { name: 'scope', type: 'jsonb', nullable: true },
] as const satisfies readonly SignalColumn[];

export const FEEDBACK_EVENT_COLUMNS = [
  CURSOR_ID_COLUMN,
  { name: 'feedbackId', type: 'text' },
  { name: 'timestamp', type: 'timestamptz' },
  { name: 'feedbackSource', type: 'text' },
  { name: 'feedbackType', type: 'text' },
  { name: 'valueString', type: 'text', nullable: true },
  { name: 'valueNumber', type: 'double precision', nullable: true },
  { name: 'comment', type: 'text', nullable: true },
  { name: 'feedbackUserId', type: 'text', nullable: true },
  { name: 'sourceId', type: 'text', nullable: true },
  ...COMMON_CONTEXT_COLUMNS,
  { name: 'tags', type: 'text[]', defaultSql: "'{}'" },
  { name: 'metadata', type: 'jsonb', nullable: true },
  { name: 'scope', type: 'jsonb', nullable: true },
] as const satisfies readonly SignalColumn[];

export const SPAN_LIGHT_SELECT_COLUMN_NAMES = [
  'cursorId',
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'entityType',
  'entityId',
  'entityName',
  'spanType',
  'error',
  'isEvent',
  'startedAt',
  'endedAt',
] as const;

function quotedColumnName(name: string): string {
  return `"${name}"`;
}

function columnDefinition(column: SignalColumn): string {
  const nullable = column.nullable ? '' : ' NOT NULL';
  const defaultSql = column.defaultSql ? ` DEFAULT ${column.defaultSql}` : '';
  return `  ${quotedColumnName(column.name)} ${column.type}${nullable}${defaultSql}`;
}

export function buildColumnDefinitions(columns: readonly SignalColumn[]): string {
  return columns.map(columnDefinition).join(',\n');
}

export function buildSelectColumns(columns: readonly SignalColumn[]): string {
  return `\n  ${columns.map(column => quotedColumnName(column.name)).join(',\n  ')}\n`;
}

export function buildNamedSelectColumns(columnNames: readonly string[]): string {
  return `\n  ${columnNames.map(quotedColumnName).join(',\n  ')}\n`;
}

function columnNamesByType(columns: readonly SignalColumn[], type: ColumnType): string[] {
  return columns.filter(column => column.type === type).map(column => column.name);
}

function typedColumnNames(columns: readonly SignalColumn[]): Set<string> {
  return new Set(
    columns.filter(column => !['bigserial', 'jsonb', 'text[]'].includes(column.type)).map(column => column.name),
  );
}

const ALL_EVENT_COLUMNS = [
  ...SPAN_EVENT_COLUMNS,
  ...METRIC_EVENT_COLUMNS,
  ...LOG_EVENT_COLUMNS,
  ...SCORE_EVENT_COLUMNS,
  ...FEEDBACK_EVENT_COLUMNS,
] as const;

export const JSONB_COLUMNS = new Set(columnNamesByType(ALL_EVENT_COLUMNS, 'jsonb'));
export const TEXT_ARRAY_COLUMNS = new Set(columnNamesByType(ALL_EVENT_COLUMNS, 'text[]'));

export const METRIC_TYPED_COLUMNS = typedColumnNames(METRIC_EVENT_COLUMNS);
export const SCORE_TYPED_COLUMNS = typedColumnNames(SCORE_EVENT_COLUMNS);
export const FEEDBACK_TYPED_COLUMNS = typedColumnNames(FEEDBACK_EVENT_COLUMNS);
