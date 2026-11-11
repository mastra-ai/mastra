import {
  listLogsArgsSchema,
  listLogsResponseSchema,
  traceQueryRequestSchema,
  traceQueryResponseSchema,
} from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';
import { traceSpans } from './trace-server';

export const TRACE_LIST_URI = 'ui://mastra/trace-list';

const at = (seconds: number) => new Date(Date.now() - 60_000 + seconds * 1000).toISOString();

/** Root spans of two runs, one per agent, as the built-in server's trace tools return them. */
const traces = [
  { traceId: 'trace-1', entityName: 'weather-agent', input: 'what is the weather?', startedAt: at(0), endedAt: at(6) },
  { traceId: 'trace-2', entityName: 'support-agent', input: 'refund order 42', startedAt: at(10), endedAt: at(12) },
];

const queryRow = (trace: (typeof traces)[number]) => ({
  traceId: trace.traceId,
  rootSpanId: 'root',
  name: `agent run: '${trace.entityName}'`,
  entityId: trace.entityName,
  parentSpanId: null,
  createdAt: trace.startedAt,
  metadata: null,
  inputPreview: trace.input,
  outputPreview: 'done',
  errorPreview: null,
  threadId: null,
  resourceId: null,
  startedAt: trace.startedAt,
  endedAt: trace.endedAt,
  entityName: trace.entityName,
  entityType: 'agent',
  environment: null,
  status: 'success' as const,
});

const listRow = (trace: (typeof traces)[number]) => ({
  ...traceSpans[0]!,
  traceId: trace.traceId,
  name: `agent run: '${trace.entityName}'`,
  entityType: 'agent',
  entityId: trace.entityName,
  entityName: trace.entityName,
  input: trace.input,
  startedAt: trace.startedAt,
  endedAt: trace.endedAt,
  createdAt: trace.startedAt,
  updatedAt: trace.endedAt,
});

/** One log line per run: the support agent's carrier lookup failed. */
const logRecords = [
  { level: 'info' as const, message: 'Forecast fetched for Lisbon', traceId: 'trace-1', entityName: 'weather-agent' },
  {
    level: 'error' as const,
    message: 'Carrier lookup failed for order 42',
    traceId: 'trace-2',
    entityName: 'support-agent',
  },
].map((log, index) => ({ ...log, timestamp: new Date(at(index * 10 + 2)), spanId: 'root', entityType: 'agent' }));

/** Applies the one predicate shape these tests open the list with: `entityName` equals a literal. */
function matches(where: unknown, trace: (typeof traces)[number]): boolean {
  if (!where) return true;
  const predicate = where as { op: string; args?: unknown[]; left?: { path?: string }; right?: { literal?: unknown } };
  if (predicate.op === 'and') return predicate.args!.every(arg => matches(arg, trace));
  if (predicate.op === 'eq' && predicate.left?.path === 'entityName')
    return trace.entityName === predicate.right?.literal;
  throw new Error(`Unsupported predicate in test server: ${JSON.stringify(where)}`);
}

/**
 * What `get_observability_capabilities` reports for a store that runs trace queries (the shape DuckDB reports),
 * less the aggregates, discovery and span/thread queries this server doesn't serve; or for one that only lists.
 */
function capabilities(traceQuery: boolean, logs: boolean) {
  const queries = {
    traceQuery,
    traceQueryTextSearch: false,
    traceQueryRootDuration: traceQuery,
    traceQueryContextIds: traceQuery,
    traceQueryContextFields: traceQuery,
    traceQueryTimeToFirstChunk: traceQuery,
    traceQueryRootSpanFields: traceQuery,
    traceQueryRootEntityId: traceQuery,
    traceQueryTimeToFirstChunkSort: traceQuery,
    traceQueryTimeToFirstToken: traceQuery,
    traceQueryTimeToFirstTokenSort: traceQuery,
    traceQueryOutcomeFields: traceQuery,
    traceQueryTenantScope: traceQuery,
  };
  return {
    metrics: false,
    logs,
    discovery: {
      entityTypes: false,
      entityNames: false,
      serviceNames: false,
      environments: false,
      tags: false,
      metrics: false,
    },
    deltaPolling: false,
    ...queries,
    traceQueryDiscovery: false,
    traceAggregate: false,
    threadQuery: false,
    threadQueryRows: false,
    spanQuery: false,
    spanQueryTextSearch: false,
    spanQueryContextFields: false,
    spanQueryModelFields: false,
    spanQueryOutcomeFields: false,
    spanAggregate: false,
    spanAggregateModelDimensions: false,
    aggregateTimeToFirstMeasures: false,
    feedback: false,
  };
}

/**
 * The observability tools the trace list calls, answering as the built-in server does for a store that runs
 * trace queries (`traceQuery`) or one that only lists traces. Requests are validated as the real tools validate
 * them: `query_traces` with core's request schema, `list_traces` with integer paging. With `logs`, the store
 * also keeps logs and the caller can read them through `list_logs`, filtered by `level`.
 */
export function traceListServer({ traceQuery, logs = false }: { traceQuery: boolean; logs?: boolean }) {
  const calls: { tool: string; args: Record<string, any> }[] = [];
  const record = (tool: string, args: Record<string, any>) => calls.push({ tool, args });

  const queryTools = {
    query_traces: createTool({
      id: 'query_traces',
      description: 'Queries traces',
      inputSchema: z.object({}).passthrough(),
      execute: async args => {
        record('query_traces', args);
        const request = traceQueryRequestSchema.parse(args);
        const rows = traces.filter(trace => matches(request.where, trace)).map(queryRow);
        return traceQueryResponseSchema.parse({ traces: rows, page: { next: null } });
      },
    }),
  };
  const listTools = {
    list_traces: createTool({
      id: 'list_traces',
      description: 'Lists traces',
      inputSchema: z.object({ page: z.number().int().optional(), perPage: z.number().int().optional() }).passthrough(),
      execute: async args => {
        record('list_traces', args);
        return {
          pagination: { total: traces.length, page: args.page ?? 0, perPage: args.perPage ?? 25, hasMore: false },
          spans: traces.map(listRow),
        };
      },
    }),
  };

  const logTools = {
    list_logs: createTool({
      id: 'list_logs',
      description: 'Lists logs',
      inputSchema: z.object({}).passthrough(),
      execute: async args => {
        record('list_logs', args);
        const { filters } = listLogsArgsSchema.parse({ filters: { level: args.level } });
        const rows = logRecords.filter(log => !filters?.level || [filters.level].flat().includes(log.level));
        return listLogsResponseSchema.parse({
          logs: rows,
          pagination: { total: rows.length, page: 0, perPage: 25, hasMore: false },
        });
      },
    }),
  };

  const server = new MCPServer({
    id: 'traces',
    name: 'Traces',
    version: '1.0.0',
    tools: {
      ...(traceQuery ? queryTools : listTools),
      ...(logs ? logTools : {}),
      get_observability_capabilities: createTool({
        id: 'get_observability_capabilities',
        description: 'Store capabilities',
        inputSchema: z.object({}),
        execute: async () => ({
          observabilityStorageType: 'Test',
          capabilities: capabilities(traceQuery, logs),
          tools: { logs, metrics: false },
        }),
      }),
      get_trace: createTool({
        id: 'get_trace',
        description: 'Reads a trace',
        inputSchema: z.object({ traceId: z.string(), offset: z.number().optional() }),
        execute: async args => {
          record('get_trace', args);
          return { traceId: args.traceId, spanCount: traceSpans.length, spans: traceSpans };
        },
      }),
    },
  });
  return { server, calls };
}
