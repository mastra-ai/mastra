import type { App } from '@modelcontextprotocol/ext-apps';
import { readResult } from './mcp-app';

type Args = Record<string, unknown>;

/**
 * A query the app was opened with: `where` and `textSearch` apply to every trace query and aggregate the app
 * sends, and `logs` to every log list.
 */
export type OpenedTraceFilter = { where?: unknown; textSearch?: unknown; logs?: Args };

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

/** Paging params of Mastra's list routes, which the routes coerce from strings and the tools take as integers. */
const INTEGER_PARAMS = new Set(['page', 'perPage']);

/** Query params as tool arguments: Mastra's list routes take complex values as JSON strings. */
function queryArgs(params: URLSearchParams): Args {
  const args: Args = {};
  for (const [key, value] of params) {
    if (INTEGER_PARAMS.has(key) && /^\d+$/.test(value)) {
      args[key] = Number(value);
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(value);
      args[key] = typeof parsed === 'object' && parsed !== null ? parsed : value;
    } catch {
      args[key] = value;
    }
  }
  return args;
}

function withOpenedFilter(args: Args, opened: OpenedTraceFilter | undefined): Args {
  if (!opened) return args;
  const next = { ...args };
  if (opened.where) next.where = next.where ? { op: 'and', args: [opened.where, next.where] } : opened.where;
  if (opened.textSearch && !next.textSearch) next.textSearch = opened.textSearch;
  return next;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

class ToolError extends Error {}

async function call(app: App, tool: string, args: Args): Promise<unknown> {
  const result = await app.callServerTool({ name: tool, arguments: args });
  if (result.isError) {
    throw new ToolError(result.content.find(block => block.type === 'text')?.text ?? `${tool} failed.`);
  }
  return readResult(result);
}

/**
 * The server cuts a page whose rows don't fit in one tool result and then drops its cursor, which would end
 * paging early. Asking again for only the rows that fit returns the same rows with their cursor.
 */
async function callPage(app: App, route: ToolRoute, args: Args): Promise<unknown> {
  if (route.offsetRows) return callOffsetPage(app, route.tool, route.offsetRows, args);
  const result = (await call(app, route.tool, args)) as Args | undefined;
  const rows = route.rows && result?.truncated ? result[route.rows] : undefined;
  const page = args.page as { limit?: number } | undefined;
  if (!Array.isArray(rows) || rows.length === 0 || !page || rows.length >= (page.limit ?? Infinity)) return result;
  return call(app, route.tool, { ...args, page: { ...page, limit: rows.length } });
}

type OffsetPage = Args & { pagination?: { hasMore?: boolean } };

/**
 * The same for a list paged by `page` and `perPage`: the rest of a cut page is read as smaller pages that tile
 * it, sized to a divisor of `perPage` no larger than the rows that fit, and returned as the page asked for.
 */
async function callOffsetPage(app: App, tool: string, key: string, args: Args): Promise<unknown> {
  const result = (await call(app, tool, args)) as OffsetPage | undefined;
  const rows = result?.truncated ? result[key] : undefined;
  const { page = 0, perPage } = args as { page?: number; perPage?: unknown };
  if (!Array.isArray(rows) || rows.length === 0 || typeof perPage !== 'number' || rows.length >= perPage) {
    return result;
  }
  let size = rows.length;
  while (perPage % size !== 0) size--;
  const all: unknown[] = [];
  let last: OffsetPage | undefined;
  for (let part = 0; part < perPage / size; part++) {
    last = (await callOffsetPage(app, tool, key, {
      ...args,
      page: (page * perPage) / size + part,
      perPage: size,
    })) as OffsetPage;
    const partRows = (last[key] as unknown[] | undefined) ?? [];
    all.push(...partRows);
    if (!last.pagination?.hasMore || partRows.length < size) break;
  }
  return { ...last, [key]: all, pagination: { ...last!.pagination, page, perPage } };
}

/** `get_trace` pages long traces by `nextOffset`; Studio's light trace has every span. */
async function lightTrace(app: App, traceId: string): Promise<unknown> {
  const first = (await call(app, 'get_trace', { traceId })) as { spans: unknown[]; nextOffset?: number };
  const spans = [...first.spans];
  let offset = first.nextOffset;
  while (offset !== undefined) {
    const page = (await call(app, 'get_trace', { traceId, offset })) as { spans: unknown[]; nextOffset?: number };
    if (page.spans.length === 0) break;
    spans.push(...page.spans);
    offset = page.nextOffset;
  }
  return { traceId, spans };
}

/** Span details fetched at once: enough to keep a long trace quick without flooding the host. */
const FULL_TRACE_CONCURRENCY = 8;

async function fullTrace(app: App, traceId: string): Promise<unknown> {
  const { spans } = (await lightTrace(app, traceId)) as { spans: { spanId: string }[] };
  const full: unknown[] = new Array(spans.length);
  let next = 0;
  const worker = async () => {
    while (next < spans.length) {
      const index = next++;
      const { span } = (await call(app, 'get_span', { traceId, spanId: spans[index]!.spanId })) as { span: unknown };
      full[index] = span;
    }
  };
  await Promise.all(Array.from({ length: Math.min(FULL_TRACE_CONCURRENCY, spans.length) }, worker));
  return { traceId, spans: full };
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
        if (route.tool === 'get_observability_capabilities') {
          // The tools don't take delta polling, so the lists reload their pages instead. Logs and metrics show
          // only when this caller's tools serve them.
          const { capabilities, tools, ...rest } = result as { capabilities: Args; tools?: Args };
          return json({
            ...rest,
            capabilities: {
              ...capabilities,
              deltaPolling: false,
              logs: capabilities.logs === true && tools?.logs === true,
              metrics: capabilities.metrics === true && tools?.metrics === true,
            },
          });
        }
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
