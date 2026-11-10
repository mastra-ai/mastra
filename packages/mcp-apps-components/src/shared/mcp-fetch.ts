import type { App } from '@modelcontextprotocol/ext-apps';
import { readResult } from './mcp-app';

type Args = Record<string, unknown>;

/** A query the app was opened with: its filters apply to every trace query and aggregate the app sends. */
export type OpenedTraceFilter = { where?: unknown; textSearch?: unknown };

type ToolRoute = {
  method: 'GET' | 'POST';
  path: RegExp;
  tool: string;
  /** The tool's arguments, from the path match, the JSON body (POST) or the query params (GET). */
  args: (match: RegExpMatchArray, input: Args) => Args;
  /** The response's row list, for paging around rows the server cut to fit one tool result. */
  rows?: string;
  /** Takes the opened query's filters. */
  filtered?: boolean;
};

const input = (_match: RegExpMatchArray, args: Args) => args;

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
  { method: 'GET', path: /^\/observability\/traces(\/light)?$/, tool: 'list_traces', args: input },
  { method: 'GET', path: /^\/observability\/scores$/, tool: 'list_scores', args: input },
  { method: 'GET', path: /^\/observability\/feedback$/, tool: 'list_feedback', args: input },
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
  const result = (await call(app, route.tool, args)) as Args | undefined;
  const rows = route.rows && result?.truncated ? result[route.rows] : undefined;
  const page = args.page as { limit?: number } | undefined;
  if (!Array.isArray(rows) || rows.length === 0 || !page || rows.length >= (page.limit ?? Infinity)) return result;
  return call(app, route.tool, { ...args, page: { ...page, limit: rows.length } });
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
      if (route.filtered) args = withOpenedFilter(args, getOpened());
      try {
        if (route.tool === 'get_trace') return json(await lightTrace(app, args.traceId as string));
        const result = await callPage(app, route, args);
        if (route.tool === 'get_observability_capabilities') {
          // The tools don't take delta polling, so the lists reload their pages instead.
          const capabilities = (result as { capabilities: Args }).capabilities;
          return json({ ...(result as Args), capabilities: { ...capabilities, deltaPolling: false } });
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
