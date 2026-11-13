/**
 * What the model reads from an observability tool when the caller renders its result in an MCP App. Hosts give
 * the model a result's `content` and the app its `structuredContent`, so the app gets every field and the model a
 * line per row: enough to answer and to pick the trace or span to look into next.
 */

type Row = Record<string, unknown>;

const DETAILS = 'Call get_trace with a traceId for its span tree, and get_span for a span’s full input and output.';

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);

const rowsOf = (output: Row, key: string): Row[] => (Array.isArray(output[key]) ? output[key].filter(isRow) : []);

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const line = value.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
};

function duration(row: Row): string | undefined {
  if (typeof row.durationMs === 'number') return `${row.durationMs}ms`;
  const start = Date.parse(String(row.startedAt));
  const end = Date.parse(String(row.endedAt));
  return Number.isNaN(start) || Number.isNaN(end) ? undefined : `${end - start}ms`;
}

function errorOf(row: Row): string | undefined {
  const error = row.errorPreview ?? (isRow(row.error) ? row.error.message : row.error);
  const message = text(error, 200);
  return message && `error: ${message}`;
}

const cells = (...values: unknown[]) =>
  values.filter((value): value is string => typeof value === 'string' && value !== '').join(' | ');

const entity = (row: Row) => cells(row.entityType ?? row.spanType, text(row.entityName ?? row.name, 80));

const status = (row: Row) => (typeof row.status === 'string' ? row.status : row.error ? 'error' : undefined);

/** Paging the model can act on: the clip note from `fitRows`, a keyset cursor, or offset pages. */
function paging(output: Row): string[] {
  const lines: string[] = [];
  if (typeof output.truncated === 'string') lines.push(output.truncated);
  const page = isRow(output.page) ? output.page : undefined;
  if (typeof page?.next === 'string') lines.push(`More rows: call again with page.after = "${page.next}".`);
  const pagination = isRow(output.pagination) ? output.pagination : undefined;
  if (pagination?.hasMore) {
    lines.push(
      `${String(pagination.total)} rows in all. More rows: call again with page = ${Number(pagination.page) + 1}.`,
    );
  }
  return lines;
}

function summary(heading: string, lines: string[], output: Row, footer = DETAILS): string {
  return [heading, ...lines, ...paging(output), footer].join('\n');
}

/** Trace rows: `query_traces` returns them under `traces`, `list_traces` (root spans) under `spans`. */
export function summarizeTraces(key: 'traces' | 'spans') {
  return (output: Row) => {
    // `query_traces` grouped by thread returns the threads that matched, under `groups`.
    if (Array.isArray(output.groups)) {
      const groups = rowsOf(output, 'groups');
      return summary(
        `${groups.length} threads matched (threadId):`,
        groups.map(group => `- ${cells(group.threadId)}`),
        output,
        'Call query_traces with a threadId filter for the traces in a thread.',
      );
    }
    const rows = rowsOf(output, key);
    return summary(
      `${rows.length} traces, shown to the user in the observability explorer (traceId | entity | status | started | duration):`,
      rows.map(
        row =>
          `- ${cells(row.traceId, entity(row), status(row), row.startedAt, duration(row), errorOf(row), text(row.inputPreview, 80) && `input: ${text(row.inputPreview, 80)}`)}`,
      ),
      output,
    );
  };
}

/** A log's `data` as one line of JSON, without stack traces, which `list_logs` still returns in full. */
function dataOf(row: Row): string | undefined {
  if (!isRow(row.data) || !Object.keys(row.data).length) return undefined;
  const line = text(
    JSON.stringify(row.data, (key, value: unknown) => (key === 'stack' ? undefined : value)),
    160,
  );
  return line && `data: ${line}`;
}

export function summarizeLogs(output: Row): string {
  const rows = rowsOf(output, 'logs');
  return summary(
    `${rows.length} logs, shown to the user in the observability explorer (time | level | entity | message | data | trace and span):`,
    rows.map(row => {
      const where =
        typeof row.traceId === 'string'
          ? `trace ${row.traceId}${row.spanId ? ` span ${String(row.spanId)}` : ''}`
          : undefined;
      return `- ${cells(row.timestamp, row.level, row.entityName ? entity(row) : undefined, text(row.message, 200), dataOf(row), where)}`;
    }),
    output,
  );
}

/** A light trace as an indented span tree, children under their parent in start order. */
export function summarizeTrace(output: Row): string {
  const spans = rowsOf(output, 'spans');
  const ids = new Set(spans.map(span => span.spanId));
  const children = new Map<unknown, Row[]>();
  for (const span of spans) {
    // A parent outside this page (an offset page) makes the span a root here.
    const parent = ids.has(span.parentSpanId) ? span.parentSpanId : null;
    children.set(parent, [...(children.get(parent) ?? []), span]);
  }
  const lines: string[] = [];
  const walk = (parent: unknown, depth: number) => {
    for (const span of children.get(parent) ?? []) {
      lines.push(
        `${'  '.repeat(depth)}- ${cells(span.spanId, cells(span.spanType, text(span.name, 80)), status(span), duration(span), errorOf(span))}`,
      );
      walk(span.spanId, depth + 1);
    }
  };
  walk(null, 0);
  const count = typeof output.spanCount === 'number' ? output.spanCount : spans.length;
  const rest =
    typeof output.nextOffset === 'number'
      ? [`More spans: call get_trace again with offset = ${output.nextOffset}.`]
      : [];
  return [
    `Trace ${String(output.traceId)}: ${count} spans, shown to the user in Studio's trace viewer (spanId | type and name | status | duration):`,
    ...lines,
    ...rest,
    'Call get_span with the traceId and a spanId for its full input, output, and attributes.',
  ].join('\n');
}

const num = (value: unknown) => (typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : undefined);

/** A series as its range and endpoints: the app charts every point. */
function seriesLine(label: string, series: Row): string {
  const points = rowsOf(series, 'points').filter(point => typeof point.value === 'number');
  if (!points.length) return `- ${label}: no data`;
  const values = points.map(point => point.value as number);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `- ${label}: ${points.length} points from ${String(first.timestamp)} (${num(first.value)}) to ${String(last.timestamp)} (${num(last.value)}), min ${num(Math.min(...values))}, max ${num(Math.max(...values))}`;
}

/** `analyze_metrics` results, by op: an aggregate, breakdown groups, or time series / percentile series. */
export function summarizeMetrics(output: Row): string {
  const footer = 'The user sees these metrics charted in the observability explorer.';
  if (Array.isArray(output.groups)) {
    const groups = rowsOf(output, 'groups');
    return summary(
      `${groups.length} groups (dimensions | value | cost):`,
      groups.map(group => {
        const dimensions = isRow(group.dimensions)
          ? Object.entries(group.dimensions)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(', ')
          : undefined;
        return `- ${cells(dimensions, num(group.value), num(group.estimatedCost) && `${num(group.estimatedCost)} ${group.costUnit ?? ''}`.trim())}`;
      }),
      output,
      footer,
    );
  }
  if (Array.isArray(output.series)) {
    const series = rowsOf(output, 'series');
    return summary(
      `${series.length} series:`,
      series.map(line => seriesLine(typeof line.name === 'string' ? line.name : `p${num(line.percentile)}`, line)),
      output,
      footer,
    );
  }
  return [
    `Value: ${num(output.value) ?? 'no data'}`,
    ...(output.previousValue != null ? [`Previous period: ${num(output.previousValue)}`] : []),
    ...(output.changePercent != null ? [`Change: ${num(output.changePercent)}%`] : []),
    ...(output.estimatedCost != null
      ? [`Estimated cost: ${num(output.estimatedCost)} ${output.costUnit ?? ''}`.trim()]
      : []),
    footer,
  ].join('\n');
}
