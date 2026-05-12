import type { ColumnConfig } from '@mastra/playground-ui';
import { TracesDataList } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { getInputPreview } from '@/domains/observability/utils/span-utils';

export type Trace = {
  traceId: string;
  name: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  attributes?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  input?: unknown;
  startedAt?: Date | string | null;
  createdAt: Date | string;
  threadId?: string | null;
  /** Computed by the storage layer from `error` + `endedAt` (success / running / error). */
  status?: string | null;
  // Optional top-level fields that mirror the traces filter set — read via `(trace as any)[field]` at runtime
  rootEntityType?: string | null;
  rootEntityId?: string | null;
  rootEntityName?: string | null;
  serviceName?: string | null;
  environment?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  resourceId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  experimentId?: string | null;
  tags?: string[] | null;
};

export type TraceColumnDef = {
  name: string;
  label: string;
  gridSize: string;
  renderCell: (trace: Trace) => ReactNode;
};

export const TRACE_CUSTOM_COLUMN_SOURCES = ['metadata', 'attributes'] as const;
export type TraceCustomColumnSource = (typeof TRACE_CUSTOM_COLUMN_SOURCES)[number];

export function formatCellValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function makeCustomColumnName(source: TraceCustomColumnSource, key: string): string {
  return `${source}:${key}`;
}

/** Look up a value by direct key first, then by walking a dotted path (`a.b.c`). */
function getByPath(obj: Record<string, any> | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  const parts = path.split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

export function resolveCustomColumnValue(trace: Trace, source: string, key: string): unknown {
  if (source === 'metadata') return getByPath(trace.metadata, key);
  if (source === 'attributes') return getByPath(trace.attributes, key);
  return undefined;
}

export const TRACE_COLUMN_DEFS: TraceColumnDef[] = [
  {
    name: 'shortId',
    label: 'ID',
    gridSize: 'auto',
    renderCell: trace => <TracesDataList.IdCell traceId={trace.traceId} />,
  },
  {
    name: 'date',
    label: 'Date',
    gridSize: 'auto',
    renderCell: trace => <TracesDataList.DateCell timestamp={trace.startedAt ?? trace.createdAt} />,
  },
  {
    name: 'time',
    label: 'Time',
    gridSize: 'auto',
    renderCell: trace => <TracesDataList.TimeCell timestamp={trace.startedAt ?? trace.createdAt} />,
  },
  {
    name: 'name',
    label: 'Name',
    gridSize: 'auto',
    renderCell: trace => <TracesDataList.NameCell name={trace.name} />,
  },
  {
    name: 'input',
    label: 'Input',
    gridSize: 'minmax(20rem,1fr)',
    renderCell: trace => <TracesDataList.InputCell input={getInputPreview(trace.input)} />,
  },
  {
    name: 'entityId',
    label: 'Entity',
    gridSize: 'auto',
    renderCell: trace => {
      const entityName =
        trace.entityName || trace.entityId || trace.attributes?.agentId || trace.attributes?.workflowId;
      return <TracesDataList.EntityCell entityType={trace.entityType} entityName={entityName} />;
    },
  },
];

export const TRACES_COLUMN_CONFIGS: ColumnConfig[] = TRACE_COLUMN_DEFS.map(({ name, label }) => ({ name, label }));
export const TRACES_COLUMN_NAMES: string[] = TRACE_COLUMN_DEFS.map(c => c.name);

/**
 * Optional built-in columns that mirror trace filter fields. Not shown by default —
 * users toggle them on from the column picker's "Filter fields" section.
 * Values read directly from the root-span record at runtime.
 */
function textColumn(name: string, label: string): TraceColumnDef {
  return {
    name,
    label,
    gridSize: 'minmax(5rem,1fr)',
    renderCell: trace => <TracesDataList.NameCell name={formatCellValue((trace as Record<string, unknown>)[name])} />,
  };
}

export const TRACE_OPTIONAL_COLUMN_DEFS: TraceColumnDef[] = [
  {
    name: 'status',
    label: 'Status',
    gridSize: 'auto',
    renderCell: trace => <TracesDataList.StatusCell status={trace.status} />,
  },
  textColumn('entityName', 'Primitive Name'),
  textColumn('serviceName', 'Service Name'),
  textColumn('environment', 'Environment'),
  textColumn('runId', 'Run ID'),
  textColumn('sessionId', 'Session ID'),
  textColumn('requestId', 'Request ID'),
  textColumn('resourceId', 'Resource ID'),
  textColumn('userId', 'User ID'),
  textColumn('organizationId', 'Organization ID'),
  textColumn('experimentId', 'Experiment ID'),
  {
    name: 'tags',
    label: 'Tags',
    gridSize: 'minmax(5rem,1fr)',
    renderCell: trace => {
      const tags = (trace as Record<string, unknown>).tags;
      const formatted = Array.isArray(tags) ? tags.join(', ') : formatCellValue(tags);
      return <TracesDataList.NameCell name={formatted} />;
    },
  },
];

export const OPTIONAL_TRACES_COLUMN_CONFIGS: ColumnConfig[] = TRACE_OPTIONAL_COLUMN_DEFS.map(({ name, label }) => ({
  name,
  label,
}));

export const ALL_BUILT_IN_COLUMN_DEFS: TraceColumnDef[] = [...TRACE_COLUMN_DEFS, ...TRACE_OPTIONAL_COLUMN_DEFS];
