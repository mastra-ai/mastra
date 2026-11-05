import { z } from 'zod';

/**
 * The Mastra route behind a read, as `MastraClient` requests it without the server's API prefix,
 * e.g. `POST /observability/metrics/aggregate`. A `:name` segment is a parameter: `GET /traces/:traceId`.
 */
export type McpAppRoute = `${'GET' | 'POST'} /${string}`;

/** Every read an MCP App UI makes, by name. */
export type McpAppReads = Record<string, McpAppRoute>;

/**
 * The `structuredContent` key carrying the context the tool that opened the UI declared. The UI
 * doesn't read it: it sends it back with each read, for `prepareRequest`.
 */
export const MCP_APP_CONTEXT_KEY = 'mastra.ai/app-context';

/** What a tool can carry to `prepareRequest` through the UI, e.g. the project the UI reads. */
export type McpAppContextSchema = z.ZodObject;

type PathParams<Path extends string> = Path extends `${infer Segment}/${infer Rest}`
  ? PathParams<Segment> | PathParams<Rest>
  : Path extends `:${infer Param}`
    ? Param
    : never;

/** The parameter names in a route: `'traceId'` for `GET /traces/:traceId`. */
export type McpAppRouteParams<Route extends string> = Route extends `${string} ${infer Path}`
  ? PathParams<Path>
  : never;

type Segment = { param: string } | { literal: string };

interface ParsedRoute {
  method: 'GET' | 'POST';
  segments: Segment[];
}

function parseRoute(route: string): ParsedRoute {
  const [method, path, ...extra] = route.split(' ');
  if ((method !== 'GET' && method !== 'POST') || !path?.startsWith('/') || extra.length) {
    throw new Error(`"${route}" isn't a read route. Write it as "GET /path" or "POST /path".`);
  }
  const seen = new Set<string>();
  const segments = path
    .slice(1)
    .split('/')
    .map((part): Segment => {
      if (!part.startsWith(':')) return { literal: part };
      const param = part.slice(1);
      if (!param || seen.has(param)) throw new Error(`"${route}" needs a distinct name for each parameter.`);
      seen.add(param);
      return { param };
    });
  return { method, segments };
}

/** Whether some request could match both routes. */
function overlaps(a: ParsedRoute, b: ParsedRoute) {
  if (a.method !== b.method || a.segments.length !== b.segments.length) return false;
  return a.segments.every((segment, i) => {
    const other = b.segments[i]!;
    return 'param' in segment || 'param' in other || segment.literal === other.literal;
  });
}

/** Parses each route, and rejects contracts where a request could match two reads. */
export function parseReads(reads: McpAppReads) {
  const parsed = Object.entries(reads).map(([read, route]) => ({ read, route, ...parseRoute(route) }));
  for (const [i, a] of parsed.entries()) {
    const b = parsed.slice(i + 1).find(other => overlaps(a, other));
    if (b) throw new Error(`The reads ${a.read} ("${a.route}") and ${b.read} ("${b.route}") match the same requests.`);
  }
  return parsed;
}

export type ParsedReads = ReturnType<typeof parseReads>;

const paramNames = (segments: Segment[]) => segments.flatMap(segment => ('param' in segment ? [segment.param] : []));

// Values the URL parser would resolve as path navigation instead of keeping as a segment.
const isUnsafeParam = (value: string) => value === '' || value === '.' || value === '..';

/** Finds the read a request is for, with its decoded parameters. */
export function matchRead(reads: ParsedReads, method: string, pathname: string) {
  const parts = pathname.slice(1).split('/');
  for (const { read, method: readMethod, segments } of reads) {
    if (readMethod !== method || segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = segments.every((segment, i) => {
      if ('literal' in segment) return segment.literal === parts[i];
      try {
        params[segment.param] = decodeURIComponent(parts[i]!);
        return true;
      } catch {
        return false;
      }
    });
    if (matches) return { read, params };
  }
  return undefined;
}

/** The read's path with each parameter encoded, e.g. `/traces/abc%2F1`. */
export function readPath({ segments }: ParsedRoute, params: Record<string, string>) {
  return `/${segments.map(segment => ('literal' in segment ? segment.literal : encodeURIComponent(params[segment.param]!))).join('/')}`;
}

/**
 * The data tool's input. MCP tools need an object input schema, so a read's arguments sit in
 * `params`, `query` and `body` instead of a union, and the refinement holds each read to its route.
 */
export function mcpAppDataInputSchema<Reads extends McpAppReads, Context extends McpAppContextSchema>(
  reads: Reads,
  parsed: ParsedReads,
  context: Context,
) {
  const names = Object.keys(reads) as [Extract<keyof Reads, string>, ...Extract<keyof Reads, string>[]];
  const byName = new Map(parsed.map(read => [read.read, read]));
  return z
    .object({
      read: z.enum(names),
      /** The route's parameters, decoded. Only reads whose route has some send them. */
      params: z.record(z.string(), z.string()).optional(),
      /** Query parameters, flattened to strings. Only `GET` reads send them. */
      query: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
      /** The JSON body. Only `POST` reads send one. */
      body: z.record(z.string(), z.unknown()).optional(),
      /** The context the tool that opened the UI returned; `{}` when it declared none. */
      context,
    })
    .superRefine(({ read, params = {}, query, body }, ctx) => {
      const { method, segments } = byName.get(read)!;
      const sendsQuery = method === 'GET';
      if (sendsQuery ? body !== undefined : query !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [sendsQuery ? 'body' : 'query'],
          message: `${read} takes its arguments as ${sendsQuery ? 'query' : 'body'}.`,
        });
      }
      const expected = paramNames(segments);
      const sent = Object.keys(params);
      if (expected.length !== sent.length || !expected.every(name => name in params)) {
        ctx.addIssue({
          code: 'custom',
          path: ['params'],
          message: expected.length ? `${read} takes the params ${expected.join(', ')}.` : `${read} takes no params.`,
        });
        return;
      }
      for (const name of expected) {
        if (isUnsafeParam(params[name]!)) {
          ctx.addIssue({ code: 'custom', path: ['params', name], message: `${name} can't be "${params[name]}".` });
        }
      }
    });
}

/** Statuses `Response.json` can't carry: informational ones, and those that forbid a body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** What the data tool answers: a status and body, as the read's Mastra route would over HTTP. */
export const mcpAppDataOutputSchema = z.object({
  status: z
    .number()
    .int()
    .min(200)
    .max(599)
    .refine(status => !NULL_BODY_STATUSES.has(status), 'A read answers with a body.'),
  body: z.unknown(),
});

export type McpAppDataOutput = z.output<typeof mcpAppDataOutputSchema>;
