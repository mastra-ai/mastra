import type { App } from '@modelcontextprotocol/ext-apps';
import { callTool, ToolError } from './mcp-app';
import {
  callCursorPage,
  callOffsetPage,
  fullTrace,
  lightTrace,
  queryArgs,
  toAppCapabilities,
  withOpenedFilter,
} from './mcp-tools';
import type { OpenedTraceFilter } from './mcp-tools';

export type { OpenedTraceFilter } from './mcp-tools';

type Args = Record<string, unknown>;

type ToolRoute = {
  method: 'GET' | 'POST';
  path: RegExp;
  tool: string;
  /** The tool's arguments, from the path match, the JSON body (POST) or the query params (GET). */
  args: (match: RegExpMatchArray, input: Args) => Args;
  /** The response's row list, for paging around rows the server cut to fit one tool result. */
  rows?: string;
  /** The same, for a list paged by `page` and `perPage` rather than a cursor. */
  offsetRows?: string;
  /** Takes the opened query's filters: its trace predicate, or its log filters. */
  filtered?: boolean | 'logs';
  /** No tool returns a full trace; it's assembled from the light trace and `get_span` per span. */
  fullTrace?: boolean;
};

const input = (_match: RegExpMatchArray, args: Args) => args;
/** The `analyze_*` tools take the op Studio's route names: `/metrics/timeseries` is `op: 'timeseries'`. */
const op = (match: RegExpMatchArray, args: Args) => ({ op: match[1], ...args });
/** Studio's discovery routes, by the kind `list_observability_values` takes. */
const VALUE_KINDS: Record<string, string> = {
  'entity-types': 'entityTypes',
  'entity-names': 'entityNames',
  'service-names': 'serviceNames',
  environments: 'environments',
  tags: 'tags',
};

/**
 * The Mastra API routes Studio's observability views call, and the built-in MCP server tool that serves each.
 * Every call goes back through the host to the server that opened the app, so it runs with the caller's own
 * permissions and never reaches further than those tools.
 */
const ROUTES: ToolRoute[] = [
  { method: 'POST', path: /^\/observability\/traces\/query\/fields$/, tool: 'get_trace_query_fields', args: input },
  { method: 'POST', path: /^\/observability\/traces\/query\/values$/, tool: 'get_trace_query_values', args: input },
  {
    method: 'POST',
    path: /^\/observability\/traces\/query$/,
    tool: 'query_traces',
    args: input,
    rows: 'traces',
    filtered: true,
  },
  {
    method: 'POST',
    path: /^\/observability\/traces\/aggregate$/,
    tool: 'aggregate_traces',
    args: input,
    filtered: true,
  },
  { method: 'POST', path: /^\/observability\/spans\/query$/, tool: 'query_spans', args: input, rows: 'spans' },
  { method: 'POST', path: /^\/observability\/spans\/aggregate$/, tool: 'aggregate_spans', args: input },
  { method: 'POST', path: /^\/observability\/threads\/query$/, tool: 'query_threads', args: input, rows: 'threads' },
  { method: 'GET', path: /^\/observability\/capabilities$/, tool: 'get_observability_capabilities', args: () => ({}) },
  {
    method: 'GET',
    path: /^\/observability\/traces\/([^/]+)\/spans\/([^/]+)$/,
    tool: 'get_span',
    args: match => ({ traceId: decodeURIComponent(match[1]!), spanId: decodeURIComponent(match[2]!) }),
  },
  {
    method: 'GET',
    path: /^\/observability\/traces\/([^/]+)\/trajectory$/,
    tool: 'get_trace_trajectory',
    args: match => ({ traceId: decodeURIComponent(match[1]!) }),
  },
  {
    method: 'GET',
    path: /^\/observability\/traces\/([^/]+)\/light$/,
    tool: 'get_trace',
    args: match => ({ traceId: decodeURIComponent(match[1]!) }),
  },
  {
    method: 'GET',
    path: /^\/observability\/traces(\/light)?$/,
    tool: 'list_traces',
    args: input,
    offsetRows: 'spans',
  },
  {
    method: 'GET',
    path: /^\/observability\/traces\/([^/]+)$/,
    tool: 'get_span',
    args: match => ({ traceId: decodeURIComponent(match[1]!) }),
    fullTrace: true,
  },
  { method: 'GET', path: /^\/observability\/scores$/, tool: 'list_scores', args: input },
  { method: 'GET', path: /^\/observability\/feedback$/, tool: 'list_feedback', args: input },
  {
    method: 'GET',
    path: /^\/observability\/logs$/,
    tool: 'list_logs',
    args: input,
    filtered: 'logs',
    offsetRows: 'logs',
  },
  {
    method: 'POST',
    path: /^\/observability\/metrics\/(aggregate|breakdown|timeseries|percentiles)$/,
    tool: 'analyze_metrics',
    args: op,
  },
  {
    method: 'POST',
    path: /^\/observability\/scores\/(aggregate|breakdown|timeseries|percentiles)$/,
    tool: 'analyze_scores',
    args: op,
  },
  {
    method: 'POST',
    path: /^\/observability\/feedback\/(aggregate|breakdown|timeseries|percentiles)$/,
    tool: 'analyze_feedback',
    args: op,
  },
  { method: 'GET', path: /^\/observability\/discovery\/metric-names$/, tool: 'list_metric_names', args: input },
  {
    method: 'GET',
    path: /^\/observability\/discovery\/metric-label-(keys|values)$/,
    tool: 'list_metric_names',
    args: input,
  },
  {
    method: 'GET',
    path: /^\/observability\/discovery\/(entity-types|entity-names|service-names|environments|tags)$/,
    tool: 'list_observability_values',
    args: (match, args) => ({ kind: VALUE_KINDS[match[1]!], ...args }),
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function callPage(app: App, route: ToolRoute, args: Args): Promise<unknown> {
  if (route.offsetRows) return callOffsetPage(app, route.tool, route.offsetRows, args);
  if (route.rows) return callCursorPage(app, route.tool, route.rows, args);
  return callTool(app, route.tool, args);
}

/**
 * A `fetch` for `MastraClient` that serves Studio's observability requests from the built-in MCP server's
 * tools, over the host's connection. Requests no tool serves get a 404, which Studio treats as unsupported.
 */
export function createMcpFetch(app: App, getOpened: () => OpenedTraceFilter | undefined): typeof fetch {
  return async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    for (const route of ROUTES) {
      if (route.method !== method) continue;
      const match = path.match(route.path);
      if (!match) continue;
      const raw = method === 'POST' && typeof init?.body === 'string' ? (JSON.parse(init.body) as Args) : {};
      let args = route.args(match, method === 'GET' ? queryArgs(url.searchParams) : raw);
      if (route.filtered === 'logs') args = { ...getOpened()?.logs, ...args };
      else if (route.filtered) args = withOpenedFilter(args, getOpened());
      try {
        if (route.fullTrace) return json(await fullTrace(app, args.traceId as string));
        if (route.tool === 'get_trace') return json(await lightTrace(app, args.traceId as string));
        const result = await callPage(app, route, args);
        if (route.tool === 'get_observability_capabilities') return json(toAppCapabilities(result));
        return json(result);
      } catch (error) {
        // A tool error is the route's answer; anything else means the tool isn't offered to this caller.
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, error instanceof ToolError ? 400 : 404);
      }
    }
    return json({ error: `Not available in this app: ${method} ${path}` }, 404);
  };
}
