import type { App } from '@modelcontextprotocol/ext-apps';
import { callTool } from './mcp-app';

type Args = Record<string, unknown>;

/**
 * A query the app was opened with: `where` and `textSearch` apply to every trace query and aggregate the app
 * sends, and `logs` to every log list.
 */
export type OpenedTraceFilter = { where?: unknown; textSearch?: unknown; logs?: Args };

/** Paging params of Mastra's list routes, which the routes coerce from strings and the tools take as integers. */
const INTEGER_PARAMS = new Set(['page', 'perPage']);

/** Query params as tool arguments: Mastra's list routes take complex values as JSON strings. */
export function queryArgs(params: URLSearchParams): Args {
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

const toParam = (value: unknown) =>
  typeof value === 'object' && !(value instanceof Date)
    ? JSON.stringify(value)
    : value instanceof Date
      ? value.toISOString()
      : String(value);

/**
 * A GET route's params as its tool receives them: what `MastraClient` would put in the query string (complex
 * values as JSON, dates as ISO strings, the rest as strings), read back the way the route reads it.
 */
export function toQueryArgs(params: Args): Args {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, toParam(value));
  }
  return queryArgs(search);
}

/** Adds the opened query's trace predicate and text search to a trace query or aggregate. */
export function withOpenedFilter(args: Args, opened: OpenedTraceFilter | undefined): Args {
  if (!opened) return args;
  const next = { ...args };
  if (opened.where) next.where = next.where ? { op: 'and', args: [opened.where, next.where] } : opened.where;
  if (opened.textSearch && !next.textSearch) next.textSearch = opened.textSearch;
  return next;
}

/**
 * The server cuts a page whose rows don't fit in one tool result and then drops its cursor, which would end
 * paging early. Asking again for only the rows that fit returns the same rows with their cursor.
 */
export async function callCursorPage(app: App, tool: string, key: string, args: Args): Promise<unknown> {
  const result = (await callTool(app, tool, args)) as Args | undefined;
  const rows = result?.truncated ? result[key] : undefined;
  const page = args.page as { limit?: number } | undefined;
  if (!Array.isArray(rows) || rows.length === 0 || !page || rows.length >= (page.limit ?? Infinity)) return result;
  return callTool(app, tool, { ...args, page: { ...page, limit: rows.length } });
}

type OffsetPage = Args & { pagination?: { hasMore?: boolean } };

/**
 * The same for a list paged by `page` and `perPage`: the rest of a cut page is read as smaller pages that tile
 * it, sized to a divisor of `perPage` no larger than the rows that fit, and returned as the page asked for.
 */
export async function callOffsetPage(app: App, tool: string, key: string, args: Args): Promise<unknown> {
  const result = (await callTool(app, tool, args)) as OffsetPage | undefined;
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
export async function lightTrace(app: App, traceId: string): Promise<unknown> {
  const first = (await callTool(app, 'get_trace', { traceId })) as { spans: unknown[]; nextOffset?: number };
  const spans = [...first.spans];
  let offset = first.nextOffset;
  while (offset !== undefined) {
    const page = (await callTool(app, 'get_trace', { traceId, offset })) as { spans: unknown[]; nextOffset?: number };
    if (page.spans.length === 0) break;
    spans.push(...page.spans);
    offset = page.nextOffset;
  }
  return { traceId, spans };
}

/** Span details fetched at once: enough to keep a long trace quick without flooding the host. */
const FULL_TRACE_CONCURRENCY = 8;

/** No tool returns a full trace; it's assembled from the light trace and `get_span` per span. */
export async function fullTrace(app: App, traceId: string): Promise<unknown> {
  const { spans } = (await lightTrace(app, traceId)) as { spans: { spanId: string }[] };
  const full: unknown[] = new Array(spans.length);
  let next = 0;
  const worker = async () => {
    while (next < spans.length) {
      const index = next++;
      const { span } = (await callTool(app, 'get_span', { traceId, spanId: spans[index]!.spanId })) as {
        span: unknown;
      };
      full[index] = span;
    }
  };
  await Promise.all(Array.from({ length: Math.min(FULL_TRACE_CONCURRENCY, spans.length) }, worker));
  return { traceId, spans: full };
}

/**
 * The capabilities as the app can use them: the tools don't take delta polling, so the lists reload their pages
 * instead, and logs and metrics show only when this caller's tools serve them.
 */
export function toAppCapabilities(result: unknown): unknown {
  const { capabilities, tools, ...rest } = result as { capabilities: Args; tools?: Args };
  return {
    ...rest,
    capabilities: {
      ...capabilities,
      deltaPolling: false,
      logs: capabilities.logs === true && tools?.logs === true,
      metrics: capabilities.metrics === true && tools?.metrics === true,
    },
  };
}
