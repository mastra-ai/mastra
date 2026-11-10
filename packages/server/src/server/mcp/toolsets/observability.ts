import * as coreStorage from '@mastra/core/storage';
import type { JSONSchema7 } from '@mastra/schema-compat';
import {
  GET_SPAN_ROUTE,
  GET_TRACE_LIGHT_ROUTE,
  GET_TRACE_ROUTE,
  GET_TRACE_TRAJECTORY_ROUTE,
  LIST_TRACES_ROUTE,
} from '../../handlers/observability';
import {
  AGGREGATE_SPANS,
  AGGREGATE_TRACES,
  GET_FEEDBACK_AGGREGATE,
  GET_FEEDBACK_BREAKDOWN,
  GET_FEEDBACK_PERCENTILES,
  GET_FEEDBACK_TIME_SERIES,
  GET_METRIC_AGGREGATE,
  GET_METRIC_BREAKDOWN,
  GET_METRIC_LABEL_KEYS,
  GET_METRIC_LABEL_VALUES,
  GET_METRIC_NAMES,
  GET_METRIC_PERCENTILES,
  GET_METRIC_TIME_SERIES,
  GET_SCORE_AGGREGATE,
  GET_SCORE_BREAKDOWN,
  GET_SCORE_PERCENTILES,
  GET_SCORE_TIME_SERIES,
  GET_TRACE_QUERY_FIELDS,
  GET_TRACE_QUERY_VALUES,
  LIST_FEEDBACK,
  LIST_LOGS,
  LIST_SCORES,
  QUERY_SPANS,
  QUERY_THREADS,
  QUERY_TRACES,
} from '../../handlers/observability-new-endpoints';
import type { ServerRoute } from '../../server-adapter';
import type { Args, CatalogueKit } from '../catalogue';
import { fitRows } from '../result-size';
import { compact, hoistRepeated, object, str, toJSONSchema } from '../schema';

const COMBINATORS = ['anyOf', 'oneOf', 'allOf', 'not'] as const;
const DELTA_POLLING = ['mode', 'after', 'limit'];
/**
 * Every way an observability list says where to continue: keyset `page`, offset `pagination`, and delta polling's
 * `delta` / `deltaCursor` (the tool schemas don't offer delta polling, but the routes still accept it). All of them
 * would skip rows that were cut, so a cut page drops whichever it has.
 */
const CURSORS = ['page', 'pagination', 'delta', 'deltaCursor'];
const PAGE_LIMIT_HINT = 'Call again with a smaller page.limit and follow page.next to see every row.';
const PER_PAGE_HINT = 'Call again with a smaller perPage to page through every row.';
const LIGHT_SPAN_FIELDS = Object.keys(coreStorage.getTraceLightResponseSchema.shape.spans.element.shape);

/** Light span record with its status (stores may omit it; the UI derives it the same way). */
function lightSpan(span: Args): Args {
  const light = Object.fromEntries(LIGHT_SPAN_FIELDS.filter(key => key in span).map(key => [key, span[key]]));
  return { ...light, status: span.status ?? coreStorage.computeTraceStatus(span) };
}

/**
 * MCP clients (and the Anthropic API) need a plain `type: object` input schema without top-level combinators.
 * The route still validates the full body; the tool schema leaves out delta polling, which needs a client loop.
 */
function asObjectSchema(schema: JSONSchema7 | undefined): JSONSchema7 {
  if (!schema || schema.type !== 'object' || COMBINATORS.some(key => key in schema)) {
    return { type: 'object', additionalProperties: true };
  }
  const properties = { ...(schema.properties as Record<string, JSONSchema7>) };
  if (properties.mode) for (const key of DELTA_POLLING) delete properties[key];
  // Trace queries take keyset `page` or offset `pagination`, never both; offer the keyset cursor only.
  if (properties.page && properties.pagination) delete properties.pagination;
  return compact({ ...schema, properties }) as JSONSchema7;
}

/**
 * List routes take filters as flat query params, where complex values may also arrive as JSON strings.
 * The tool schema keeps the structured branch and drops delta polling, which an MCP client cannot use.
 */
function listQuerySchema(route: ServerRoute): JSONSchema7 {
  const json = toJSONSchema(route.queryParamSchema);
  const properties: Record<string, JSONSchema7> = {};
  for (const [key, value] of Object.entries((json?.properties ?? {}) as Record<string, JSONSchema7>)) {
    if (DELTA_POLLING.includes(key)) continue;
    const branches = (value.anyOf ?? []) as JSONSchema7[];
    const structured = branches.filter(branch => branch.type !== 'string' || branch.enum || branch.format);
    properties[key] = branches.length > 1 && structured.length === 1 ? structured[0]! : value;
  }
  return compact({ type: 'object', properties }) as JSONSchema7;
}

const OPS = ['aggregate', 'breakdown', 'timeseries', 'percentiles'] as const;
type Op = (typeof OPS)[number];

/**
 * One `analyze_<source>` tool per family (D15). The per-op body fields are merged into one flat object
 * (each field says which ops use it); the call goes to that op's own route, which validates the body
 * and authorizes the call.
 */
function analyzeSchema(routes: Record<Op, ServerRoute>): JSONSchema7 {
  const variants = new Map<string, Map<string, JSONSchema7>>();
  const usedBy = new Map<string, Op[]>();
  const required = new Map<string, number>();
  const defs: Record<string, unknown> = {};
  for (const op of OPS) {
    // Keep each op's `$defs`, renamed so ops cannot collide.
    const json = JSON.parse(
      JSON.stringify(asObjectSchema(toJSONSchema(routes[op].bodySchema))).replaceAll('#/$defs/', `#/$defs/${op}_`),
    ) as JSONSchema7 & { $defs?: Record<string, unknown> };
    for (const [name, def] of Object.entries(json.$defs ?? {})) defs[`${op}_${name}`] = def;
    for (const [key, value] of Object.entries((json.properties ?? {}) as Record<string, JSONSchema7>)) {
      const { description: _description, ...shape } = value;
      if (!variants.has(key)) variants.set(key, new Map());
      if (!variants.get(key)!.has(JSON.stringify(shape))) variants.get(key)!.set(JSON.stringify(shape), value);
      usedBy.set(key, [...(usedBy.get(key) ?? []), op]);
    }
    for (const key of json.required ?? []) required.set(key, (required.get(key) ?? 0) + 1);
  }
  // A field can differ between ops (e.g. metrics `name` is a list except for percentiles): offer each shape.
  const properties: Record<string, JSONSchema7> = {};
  for (const [key, shapes] of variants) {
    const all = [...shapes.values()];
    properties[key] =
      all.length === 1
        ? all[0]!
        : { anyOf: all.map(({ description: _description, ...shape }) => shape), description: all[0]!.description };
  }
  for (const [key, ops] of usedBy) {
    const scope = ops.length === OPS.length ? '' : ` Used by op: ${ops.join(', ')}.`;
    const needed = ops.length !== OPS.length && required.get(key) ? ` Required for ${ops.join(', ')}.` : '';
    if (scope || needed) {
      const prop = properties[key]!;
      properties[key] = { ...prop, description: `${prop.description ?? ''}${scope}${needed}`.trim() };
    }
  }
  const alwaysRequired = [...required].filter(([, count]) => count === OPS.length).map(([key]) => key);
  return {
    ...(Object.keys(defs).length ? { $defs: defs } : {}),
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: [...OPS],
        description:
          'aggregate: one value; breakdown: grouped by labels; timeseries: bucketed over time; percentiles: distribution.',
      },
      ...properties,
    },
    required: ['op', ...alwaysRequired],
  };
}

/** Observability (traces, spans, logs) and observability analytics (metrics, scores, feedback). */
export function addObservabilityTools(kit: CatalogueKit) {
  const { call, addOperation, addCombined, config } = kit;

  if (config.toolsets.has('observability')) {
    const bodyTool = (route: ServerRoute, rows?: string, schema: unknown = route.bodySchema) =>
      addOperation(route, hoistRepeated(asObjectSchema(toJSONSchema(schema))), async (args, signal) => {
        const result = await call(route, { body: args }, signal);
        // Trace and span rows are spans, which get_span returns in full.
        const detail = rows === 'traces' || rows === 'spans' ? 'get_span' : undefined;
        return rows ? fitRows(result, rows, PAGE_LIMIT_HINT, { cursors: CURSORS, detail }) : result;
      });

    bodyTool(QUERY_TRACES, 'traces');
    bodyTool(AGGREGATE_TRACES);
    bodyTool(QUERY_SPANS, 'spans');
    bodyTool(AGGREGATE_SPANS);
    // The route also accepts the deprecated thread query shape; only the current one is offered.
    bodyTool(QUERY_THREADS, 'threads', coreStorage.threadQueryRequestSchema);
    bodyTool(GET_TRACE_QUERY_FIELDS);
    bodyTool(GET_TRACE_QUERY_VALUES);

    const traceId = str('Trace id.');
    // Light trace for every span id and the tree; get_span digs into one span. Stores without light traces
    // (DSQL) are served from the full trace, cut down to the same fields.
    const { traceStructure } = kit.capabilities;
    addOperation(
      GET_TRACE_LIGHT_ROUTE,
      object(
        {
          traceId,
          offset: { type: 'integer', minimum: 0, description: 'Spans to skip: the nextOffset of a truncated result.' },
        },
        ['traceId'],
      ),
      async (args, signal) => {
        const route = traceStructure ? GET_TRACE_LIGHT_ROUTE : GET_TRACE_ROUTE;
        const trace = (await call(route, { pathParams: { traceId: args.traceId } }, signal)) as Args;
        const spans = Array.isArray(trace?.spans) ? (trace.spans as Args[]) : [];
        const offset = typeof args.offset === 'number' ? args.offset : 0;
        const page = spans.slice(offset).map(lightSpan);
        // Safety net: a light trace is small, but a run with thousands of spans can still pass the cap.
        const result = fitRows(
          {
            traceId: trace?.traceId ?? args.traceId,
            spanCount: spans.length,
            ...(offset ? { offset } : {}),
            spans: page,
          },
          'spans',
          'Call get_trace again with offset: nextOffset for the rest.',
          { detail: 'get_span' },
        ) as Args;
        const kept = (result.spans as unknown[]).length;
        return kept < page.length ? { ...result, nextOffset: offset + kept } : result;
      },
    );
    addOperation(GET_SPAN_ROUTE, object({ traceId, spanId: str('Span id.') }, ['traceId', 'spanId']), (args, signal) =>
      call(GET_SPAN_ROUTE, { pathParams: { traceId: args.traceId, spanId: args.spanId } }, signal),
    );
    addOperation(GET_TRACE_TRAJECTORY_ROUTE, object({ traceId }, ['traceId']), (args, signal) =>
      call(GET_TRACE_TRAJECTORY_ROUTE, { pathParams: { traceId: args.traceId } }, signal),
    );
    addOperation(LIST_TRACES_ROUTE, hoistRepeated(listQuerySchema(LIST_TRACES_ROUTE)), async (args, signal) =>
      fitRows(await call(LIST_TRACES_ROUTE, { query: args }, signal), 'spans', PER_PAGE_HINT, {
        cursors: CURSORS,
        detail: 'get_span',
      }),
    );
    addOperation(LIST_LOGS, hoistRepeated(listQuerySchema(LIST_LOGS)), async (args, signal) =>
      fitRows(await call(LIST_LOGS, { query: args }, signal), 'logs', PER_PAGE_HINT, { cursors: CURSORS }),
    );
  }

  if (config.toolsets.has('observability_analytics')) {
    for (const [route, key] of [
      [LIST_SCORES, 'scores'],
      [LIST_FEEDBACK, 'feedback'],
    ] as const) {
      addOperation(route, hoistRepeated(listQuerySchema(route)), async (args, signal) =>
        fitRows(await call(route, { query: args }, signal), key, PER_PAGE_HINT, { cursors: CURSORS }),
      );
    }

    const analyze = (routes: Record<Op, ServerRoute>) =>
      addCombined(Object.values(routes), hoistRepeated(analyzeSchema(routes)), (args, signal) => {
        const { op, ...body } = args;
        const route = typeof op === 'string' && Object.hasOwn(routes, op) ? routes[op as Op] : undefined;
        if (!route) throw new Error(`Unknown op "${String(op)}". Use one of: ${OPS.join(', ')}.`);
        return call(route, { body }, signal);
      });
    analyze({
      aggregate: GET_METRIC_AGGREGATE,
      breakdown: GET_METRIC_BREAKDOWN,
      timeseries: GET_METRIC_TIME_SERIES,
      percentiles: GET_METRIC_PERCENTILES,
    });
    analyze({
      aggregate: GET_SCORE_AGGREGATE,
      breakdown: GET_SCORE_BREAKDOWN,
      timeseries: GET_SCORE_TIME_SERIES,
      percentiles: GET_SCORE_PERCENTILES,
    });
    analyze({
      aggregate: GET_FEEDBACK_AGGREGATE,
      breakdown: GET_FEEDBACK_BREAKDOWN,
      timeseries: GET_FEEDBACK_TIME_SERIES,
      percentiles: GET_FEEDBACK_PERCENTILES,
    });

    addCombined(
      [GET_METRIC_NAMES, GET_METRIC_LABEL_KEYS, GET_METRIC_LABEL_VALUES],
      object({
        metricName: str('List the label keys of this metric (or, with labelKey, one label’s values).'),
        labelKey: str('With metricName, list the values of this label.'),
        prefix: str('Only names or values starting with this.'),
        limit: { type: 'integer', minimum: 1, description: 'Maximum results.' },
      }),
      (args, signal) => {
        const { metricName, labelKey, prefix, limit } = args;
        if (labelKey && !metricName) throw new Error('labelKey needs metricName.');
        if (metricName && labelKey) {
          return call(GET_METRIC_LABEL_VALUES, { query: { metricName, labelKey, prefix, limit } }, signal);
        }
        if (metricName) return call(GET_METRIC_LABEL_KEYS, { query: { metricName } }, signal);
        return call(GET_METRIC_NAMES, { query: { prefix, limit } }, signal);
      },
    );
  }
}
