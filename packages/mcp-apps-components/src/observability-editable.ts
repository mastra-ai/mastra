/**
 * What keeps a draft to the shapes a form editor reads back and saves unchanged, for
 * `createObservabilityDraftSchemas(catalog, { editable: true })`. The editor offers a fixed set of
 * figures, formulas, filters and splits; a draft written outside them opens with the parts it
 * can't hold locked, or loses them on save. Checked on the draft, so each issue points at what the
 * model wrote.
 */

type Json = Record<string, unknown>;
type Path = PropertyKey[];
type Kind = 'kpis' | 'timeseries' | 'table' | 'scores';

export type EditableIssue = { path: Path; message: string };

/** The dimensions the editor filters and splits by. `model` and `provider` are metrics' own. */
const DIMENSIONS = [
  'entityName',
  'environment',
  'serviceName',
  'model',
  'provider',
  'resourceId',
  'threadId',
  'userId',
];
const METRICS_ONLY = ['model', 'provider'];
/** Labels a table can group its rows by before its last dimension, though they can't filter. */
const ROW_ONLY = ['projectId', 'agentId'];
/** The trace dimensions each source matches on its own fields; a trace also matches its spans' `model` and `provider`. */
const TRACE_FIELDS: Record<string, readonly string[]> = {
  traceAggregate: ['entityName', 'environment', 'resourceId', 'threadId', 'userId'],
  spanAggregate: ['entityName', 'environment', 'serviceName', 'resourceId', 'threadId', 'userId'],
};
const SPAN_FIELDS = ['model', 'provider'];
const PERCENTILES = [0.5, 0.95, 0.99];
const AGGREGATIONS = ['sum', 'count', 'avg', 'min', 'max'];
const FAILED = ['error', 'failed'];
/** The one pair of metric names the editor reads together, as total tokens or model cost. */
const TOKENS = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];
/** The duration metrics whose runs the editor turns into an error rate. */
const RUN_METRICS = ['mastra_agent_duration_ms', 'mastra_workflow_duration_ms', 'mastra_tool_duration_ms'];

const METRIC_READS = ['metricAggregate', 'metricBreakdown', 'metricTimeSeries', 'metricPercentiles'];
const TRACE_READS = ['traceAggregate', 'spanAggregate'];
const SCORE_READS = ['scoreAggregate', 'scoreTimeSeries'];
const READ_KEYS = [...METRIC_READS, ...TRACE_READS, ...SCORE_READS];

const ZERO = { const: 0 };
const FORMULAS =
  "one read, or a formula over two reads: `{ minus: [A, B] }`, `{ sum: [A, B] }`, `{ ratio: { of: A, over: B } }`, or A's share `{ ratio: { of: A, over: { sum: [A, B] } } }`, each optionally floored at zero as `{ max: [formula, { const: 0 }] }`";
const ERROR_RATE =
  'an error rate: `{ coalesce: [{ ratio: { of: R failed, over: { sum: [R not failed, R failed] } } }, { const: 0 }] }`, R a `metricTimeSeries` counting one of the run duration metrics grouped by `status`, failed as `groups: ["error", "failed"]`, not failed as `notGroups: ["error", "failed"]`';

const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);
const list = (values: readonly unknown[]) => values.map(value => `\`${JSON.stringify(value)}\``).join(', ');
const sameSet = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every(value => b.includes(value));
const nonEmpty = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

/** Canonical JSON: the same for objects that differ only in key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    isObject(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

type Ref = { read: string; args: Json; path: Path };

/** The read `value` is, when it is one. */
function refOf(value: unknown, path: Path): Ref | undefined {
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value);
  const read = keys[0];
  if (keys.length !== 1 || !read || !READ_KEYS.includes(read) || !isObject(value[read])) return undefined;
  return { read, args: value[read] as Json, path: [...path, read] };
}

/** The reads of a preset formula, as the editor writes it. */
function formulaOf(value: unknown, path: Path, floored = false): Ref[] | undefined {
  if (!isObject(value) || Object.keys(value).length !== 1) return undefined;
  const pair = (parts: unknown, at: Path) => {
    if (!Array.isArray(parts) || parts.length !== 2) return undefined;
    const refs = [refOf(parts[0], [...at, 0]), refOf(parts[1], [...at, 1])];
    return refs.every(Boolean) ? (refs as Ref[]) : undefined;
  };
  if (Array.isArray(value.max) && value.max.length === 2 && !floored) {
    const zero = value.max.findIndex(part => canonical(part) === canonical(ZERO));
    return zero < 0 ? undefined : formulaOf(value.max[1 - zero], [...path, 'max', 1 - zero], true);
  }
  if (value.minus !== undefined) return pair(value.minus, [...path, 'minus']);
  if (value.sum !== undefined) return pair(value.sum, [...path, 'sum']);
  const ratio = value.ratio;
  if (!isObject(ratio) || Object.keys(ratio).length !== 2) return undefined;
  const at = [...path, 'ratio'];
  const of = refOf(ratio.of, [...at, 'of']);
  if (!of) return undefined;
  const over = refOf(ratio.over, [...at, 'over']);
  if (over) return [of, over];
  const parts = isObject(ratio.over) && Object.keys(ratio.over).length === 1 ? ratio.over.sum : undefined;
  const share = pair(parts, [...at, 'over', 'sum']);
  return share && canonical(ratio.of) === canonical((parts as unknown[])[0]) ? share : undefined;
}

/** The read of an error rate, as the editor writes it. */
function errorRateOf(value: unknown, path: Path): Ref | undefined {
  if (!isObject(value) || !Array.isArray(value.coalesce)) return undefined;
  const ratio = isObject(value.coalesce[0]) ? value.coalesce[0].ratio : undefined;
  const of = refOf(isObject(ratio) ? ratio.of : undefined, [...path, 'coalesce', 0, 'ratio', 'of']);
  if (!of || of.read !== 'metricTimeSeries') return undefined;
  const { groups: _g, notGroups: _n, ...args } = of.args;
  const read = (pick: Json) => ({ metricTimeSeries: { ...args, ...pick } });
  const expected = {
    coalesce: [
      {
        ratio: { of: read({ groups: FAILED }), over: { sum: [read({ notGroups: FAILED }), read({ groups: FAILED })] } },
      },
      ZERO,
    ],
  };
  return canonical(value) === canonical(expected) ? of : undefined;
}

/** The dimension filters a trace or span `where` stands for, or `undefined` when it holds anything else. */
function whereFilters(source: string, where: unknown): Json | undefined {
  if (where === undefined) return {};
  const filterOf = (predicate: unknown): [string, string] | undefined => {
    if (!isObject(predicate)) return undefined;
    let inner = predicate;
    let fields = TRACE_FIELDS[source]!;
    if (isObject(predicate.spans)) {
      const { spans } = predicate;
      if (source !== 'traceAggregate' || Object.keys(predicate).length !== 1) return undefined;
      if (!isObject(spans.some) || Object.keys(spans).length !== 1) return undefined;
      inner = spans.some;
      fields = SPAN_FIELDS;
    }
    if (inner.op !== 'eq' || !isObject(inner.left) || !isObject(inner.right)) return undefined;
    const { path } = inner.left;
    const { literal } = inner.right;
    if (typeof path !== 'string' || typeof literal !== 'string' || !literal || !fields.includes(path)) return undefined;
    return [path, literal];
  };
  const predicates = isObject(where) && where.op === 'and' && Array.isArray(where.args) ? where.args : [where];
  const filters = predicates.map(filterOf);
  if (!filters.length || !filters.every(Boolean)) return undefined;
  const record = Object.fromEntries(filters as [string, string][]);
  return Object.keys(record).length === filters.length ? record : undefined;
}

/** Checks one view: what it reads, and how. */
class View {
  readonly issues: EditableIssue[] = [];
  readonly refs: Ref[] = [];

  add(path: Path, message: string) {
    this.issues.push({ path, message });
  }

  /** The reads of `value`, reporting it when the editor can't edit it. */
  value(value: unknown, path: Path, errorRate = false): Ref[] {
    const ref = refOf(value, path);
    const refs = ref ? [ref] : (formulaOf(value, path) ?? []);
    const rate = errorRate && !refs.length ? errorRateOf(value, path) : undefined;
    if (rate) {
      const { name, aggregation, groupBy, field } = rate.args;
      if (!Array.isArray(name) || name.length !== 1 || !RUN_METRICS.includes(name[0] as string))
        this.add([...rate.path, 'name'], `An error rate reads one of ${list(RUN_METRICS)}.`);
      if (aggregation !== 'count') this.add([...rate.path, 'aggregation'], 'An error rate counts runs: `count`.');
      if (canonical(groupBy) !== canonical(['status']))
        this.add([...rate.path, 'groupBy'], 'An error rate groups by `["status"]`.');
      if (field !== undefined) this.add([...rate.path, 'field'], 'An error rate reads no `field`.');
      this.ref(rate);
      return [rate];
    }
    if (!refs.length) {
      this.add(path, `The editor edits ${FORMULAS}${errorRate ? `, or ${ERROR_RATE}` : ''}. Write one of those.`);
      return [];
    }
    for (const r of refs) this.ref(r);
    return refs;
  }

  /** Checks what a read sets, apart from a chart's grouping, which its view checks. */
  ref(ref: Ref) {
    this.refs.push(ref);
    const { read, args, path } = ref;
    const at = (key: string) => [...path, key];
    if (METRIC_READS.includes(read)) {
      // A percentile names its one metric as a string.
      const names = (Array.isArray(args.name) ? args.name : [args.name]) as string[];
      const tokens = sameSet(names, TOKENS);
      if (names.length !== 1 && !tokens)
        this.add(
          at('name'),
          `Read one metric name, or ${list(TOKENS)} together: the editor offers no other combination.`,
        );
      if (read === 'metricPercentiles') {
        if (!PERCENTILES.includes(args.percentile as number))
          this.add(at('percentile'), `The editor offers the percentiles ${list(PERCENTILES)}.`);
        if (tokens) this.add(at('name'), 'A percentile reads one metric name.');
      } else if (!AGGREGATIONS.includes(args.aggregation as string)) {
        this.add(at('aggregation'), `The editor offers the aggregations ${list(AGGREGATIONS)}.`);
      } else if ((tokens || args.field === 'estimatedCost') && args.aggregation !== 'sum') {
        this.add(
          at('aggregation'),
          tokens
            ? 'Input and output tokens read together take `sum`.'
            : 'A cost (`field: "estimatedCost"`) takes `sum`.',
        );
      }
      this.filters(ref, DIMENSIONS);
    } else if (TRACE_READS.includes(read)) {
      if (whereFilters(read, args.where) === undefined) {
        const fields = [...TRACE_FIELDS[read]!, ...(read === 'traceAggregate' ? SPAN_FIELDS : [])];
        this.add(
          at('where'),
          `\`where\` can only filter on ${list(fields)}: one \`eq\` of \`{ path }\` to a \`{ literal }\` per dimension, ANDed${read === 'traceAggregate' ? ', with `model` and `provider` as `{ spans: { some: eq } }`' : ''}.`,
        );
      }
    } else {
      if (args.scoreSource !== undefined) this.add(at('scoreSource'), 'The editor reads a scorer by `scorerId` only.');
      this.filters(
        ref,
        DIMENSIONS.filter(d => !METRICS_ONLY.includes(d)),
      );
    }
    const grouped = args.groups !== undefined || args.notGroups !== undefined;
    if (grouped && read !== 'metricTimeSeries') this.add(at('groups'), 'Only a `metricTimeSeries` picks `groups`.');
  }

  filters({ args, path }: Ref, dimensions: readonly string[]) {
    if (args.filters === undefined) return;
    for (const [key, value] of Object.entries(args.filters as Json)) {
      if (!dimensions.includes(key) || typeof value !== 'string')
        this.add([...path, 'filters', key], `The editor filters on one value of ${list(dimensions)}.`);
    }
  }

  /** Every read filtered alike, as the editor applies one set of filters to the view. */
  sameFilters() {
    const filters = this.refs.map(({ read, args }) =>
      canonical(TRACE_READS.includes(read) ? (whereFilters(read, args.where) ?? {}) : (args.filters ?? {})),
    );
    if (new Set(filters).size > 1)
      this.add(
        [],
        'Every read must filter on the same dimensions and values: the editor filters the whole view at once.',
      );
  }

  /** Whether the reads compare with the window before, reporting a mix. */
  compares(): boolean {
    const compared = this.refs.filter(({ args }) => args.compare !== undefined);
    if (compared.length && compared.length !== this.refs.length)
      this.add([], 'Set `compare` on every read or on none: the editor compares the whole view.');
    return compared.length > 0 && compared.length === this.refs.length;
  }

  noTraceGroupBy() {
    for (const { read, args, path } of this.refs)
      if (TRACE_READS.includes(read) && nonEmpty(args.groupBy))
        this.add([...path, 'groupBy'], 'Only a table groups trace and span reads, by its own `groupBy`.');
  }
}

function kpisIssues(draft: Json) {
  const view = new View();
  (draft.items as Json[]).forEach((item, i) => view.value(item.value, ['items', i, 'value']));
  view.noTraceGroupBy();
  view.compares();
  view.sameFilters();
  return view.issues;
}

function timeseriesIssues(draft: Json) {
  const view = new View();
  if (draft.emptyWhenZero !== undefined)
    view.add(
      ['emptyWhenZero'],
      'Leave `emptyWhenZero` out: the editor shows a chart empty when every plotted value is zero.',
    );
  if (isObject(draft.total)) {
    if (draft.total.format !== undefined)
      view.add(['total', 'format'], "Leave `format` out: the total takes the chart's format.");
    if (draft.total.value !== 'total' && draft.total.value !== 'peak')
      view.add(['total', 'value'], 'Set the total to `total` or `peak`: the editor offers no other.');
  }
  const series = draft.series as Json[];
  const valueRefs = series.map((item, i) => {
    if (item.rangeTotal !== undefined)
      view.add(['series', i, 'rangeTotal'], "Leave `rangeTotal` out: use the chart's `total` instead.");
    return view.value(item.value, ['series', i, 'value'], true);
  });
  view.noTraceGroupBy();
  for (const { args, path } of view.refs) {
    if (args.compare !== undefined) view.add([...path, 'compare'], "A chart doesn't compare with the window before.");
  }

  const errorRates = new Set(series.map((item, i) => errorRateOf(item.value, ['series', i, 'value'])?.args));
  const split = view.refs.find(
    ({ read, args }) =>
      read === 'metricTimeSeries' && nonEmpty(args.groupBy) && canonical(args.groupBy) !== canonical(['status']),
  );
  for (const ref of view.refs) {
    if (ref.read !== 'metricTimeSeries' || errorRates.has(ref.args)) continue;
    const { groupBy, groups, notGroups, aggregation } = ref.args;
    const at = (key: string) => [...ref.path, key];
    if (!nonEmpty(groupBy)) {
      if (groups !== undefined || notGroups !== undefined) view.add(at('groups'), '`groups` picks among `groupBy`.');
    } else if (canonical(groupBy) === canonical(['status'])) {
      if (split) view.add(at('groupBy'), "A split chart can't also count runs by `status`.");
      if (aggregation !== 'count') view.add(at('aggregation'), 'Runs by `status` take `count`.');
      const failed = Array.isArray(groups) && sameSet(groups, FAILED) && notGroups === undefined;
      const ok = Array.isArray(notGroups) && sameSet(notGroups, FAILED) && groups === undefined;
      if (!failed && !ok)
        view.add(
          at('groups'),
          `Pick failed runs as \`groups: ${JSON.stringify(FAILED)}\`, the rest as \`notGroups\` of the same.`,
        );
    } else if (groupBy.length !== 1 || !DIMENSIONS.includes(groupBy[0] as string)) {
      view.add(at('groupBy'), `A chart splits by one of ${list(DIMENSIONS)}.`);
    } else if (!Array.isArray(groups) || groups.length !== 1 || notGroups !== undefined) {
      view.add(at('groups'), 'Each series of a split picks one value: `groups: [value]`.');
    }
  }
  if (split) splitIssues(view, series, valueRefs, (split.args.groupBy as string[])[0]!);
  view.sameFilters();
  return view.issues;
}

/** A split chart: each series one value of one dimension, metric by metric, each with the same values. */
function splitIssues(view: View, series: Json[], valueRefs: Ref[][], dimension: string) {
  const metrics: { identity: string; values: unknown[]; emphasis: unknown[] }[] = [];
  for (const [i, refs] of valueRefs.entries()) {
    const ref = refs.length === 1 && refOf(series[i]!.value, ['series', i, 'value']);
    if (!ref || ref.read !== 'metricTimeSeries' || canonical(ref.args.groupBy) !== canonical([dimension])) {
      view.add(
        ['series', i, 'value'],
        `A split chart's series each read one \`metricTimeSeries\` grouped by \`["${dimension}"]\`.`,
      );
      return;
    }
    const { groups, ...args } = ref.args;
    const identity = canonical(args);
    let metric = metrics.at(-1);
    if (metric?.identity !== identity) {
      if (metrics.some(m => m.identity === identity)) {
        view.add(['series', i], "List a split metric's series together, one after another.");
        return;
      }
      metric = { identity, values: [], emphasis: [] };
      metrics.push(metric);
    }
    metric.values.push((groups as unknown[] | undefined)?.[0]);
    metric.emphasis.push(series[i]!.emphasis ?? false);
  }
  const values = canonical(metrics[0]!.values);
  if (metrics.some(m => canonical(m.values) !== values))
    view.add(['series'], `Every split metric lists the same \`${dimension}\` values, in the same order.`);
  if (metrics.some(m => new Set(m.emphasis).size > 1))
    view.add(['series'], "Emphasize all of a split metric's series or none.");
}

function tableIssues(draft: Json) {
  const view = new View();
  const columns = draft.columns as Json[];
  const groupBy = draft.groupBy as string[];
  const types = columns.map(column =>
    ['name', 'dimension', 'value', 'change'].find(type => column[type] !== undefined),
  );
  if (types[0] !== 'name' || types.lastIndexOf('name') !== 0)
    view.add(['columns'], 'Start with one `name` column, then the value columns, then at most one `change` column.');
  const change = types.indexOf('change');
  if (change >= 0 && (change !== types.length - 1 || types.lastIndexOf('change') !== change))
    view.add(['columns', change], 'One `change` column comes last.');
  columns.forEach((column, i) => {
    const type = types[i];
    if (type === 'dimension')
      view.add(
        ['columns', i, 'dimension'],
        'Name rows with the `name` column only: the editor has no `dimension` column.',
      );
    if (column.id !== undefined) view.add(['columns', i, 'id'], 'Leave `id` out: the editor names its columns itself.');
    if (column.sort !== undefined && type !== 'value')
      view.add(['columns', i, 'sort'], 'Only a value column sorts the table.');
    if (type !== 'value') return;
    const body = column.value as Json;
    if (body.unpricedWhen !== undefined)
      view.add(['columns', i, 'value', 'unpricedWhen'], 'Leave `unpricedWhen` out: the editor has no such setting.');
    const [key] = Object.keys(body).filter(
      k => READ_KEYS.includes(k) || ['const', 'sum', 'minus', 'ratio', 'max', 'coalesce'].includes(k),
    );
    view.value(key ? { [key]: body[key] } : {}, ['columns', i, 'value']);
  });
  const last = groupBy.at(-1);
  if (!last || !DIMENSIONS.includes(last)) view.add(['groupBy'], `The rows group by one of ${list(DIMENSIONS)}, last.`);
  groupBy.slice(0, -1).forEach((label, i) => {
    if (!DIMENSIONS.includes(label) && !ROW_ONLY.includes(label))
      view.add(['groupBy', i], `The rows group by ${list([...DIMENSIONS, ...ROW_ONLY])}.`);
  });
  for (const { args, path } of view.refs) {
    if (args.groupBy !== undefined && canonical(args.groupBy) !== canonical(groupBy))
      view.add([...path, 'groupBy'], "Leave `groupBy` out: a table's reads group by its own.");
  }
  const compared = view.compares();
  if (change >= 0 && !compared) view.add(['columns', change], 'A `change` column needs `compare` on every read.');
  if (change < 0 && compared) view.add([], 'Reads compare only when a `change` column shows it.');
  view.sameFilters();
  return view.issues;
}

function scoresIssues(draft: Json) {
  const view = new View();
  if (draft.scoreSource !== undefined) view.add(['scoreSource'], 'The editor reads a scorer by `scorerId` only.');
  const parts = ['average', 'series'].map(part => ({
    read: 'scoreAggregate',
    args: (draft[part] ?? {}) as Json,
    path: [part],
  }));
  for (const part of parts)
    view.filters(
      part,
      DIMENSIONS.filter(d => !METRICS_ONLY.includes(d)),
    );
  if (canonical(parts[0]!.args.filters ?? {}) !== canonical(parts[1]!.args.filters ?? {}))
    view.add([], '`average` and `series` must filter alike.');
  return view.issues;
}

/** Why the editor can't edit a view draft of `kind` as written; none when it can. */
export function editableIssues(kind: Kind, draft: Json): EditableIssue[] {
  if (kind === 'kpis') return kpisIssues(draft);
  if (kind === 'timeseries') return timeseriesIssues(draft);
  if (kind === 'table') return tableIssues(draft);
  return scoresIssues(draft);
}
