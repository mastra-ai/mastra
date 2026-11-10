import {
  DASHBOARD_MAX_QUERIES_PER_VIEW,
  DASHBOARD_MAX_WIDGETS,
  DASHBOARD_SCHEMA_VERSION,
  dashboardDefaultsSchema,
  dashboardDefinitionSchema,
  dashboardQuerySchema,
  dashboardWidgetSchema,
  dashboardWidgetViewSchema,
} from '@mastra/core/storage/dashboards';
import type {
  DashboardColumn,
  DashboardDefaults,
  DashboardDefinition,
  DashboardQuery,
  DashboardWidget,
  DashboardWidgetView,
} from '@mastra/core/storage/dashboards';
import { kpisIssues, kpisOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import { scoresIssues, scoresOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/scores/options';
import {
  tableColumnOptionsSchema,
  tableIssues,
  tableOptionsSchema,
} from '@mastra/playground-ui/domains/dashboards/lib/table';
import {
  timeseriesIssues,
  timeseriesOptionsSchema,
  timeseriesSeriesSchema,
} from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import { valueRefSchema } from '@mastra/playground-ui/domains/dashboards/lib/values';
import type { ValueExpr, ValueRef } from '@mastra/playground-ui/domains/dashboards/lib/values';
import { z } from 'zod/v4';
import { OBSERVABILITY_DATE_PRESETS } from './apps/observability-widget/tool';
import type { ObservabilityDatePreset } from './apps/observability-widget/tool';

/*
 * The model writes a dashboard in an authoring shape that `toObservabilityDashboard` turns into the
 * stored definition. The definition keeps a view's reads in a `queries` list that options point
 * into by id (values, a chart's `totals`, a total's `peak`, a table's `defaultSort`). The authoring shape has no such ids: each value holds the read it shows, and the
 * converter gathers identical reads into one query. What a value can read depends on where it
 * sits, so a read that can't work there (a breakdown in a chart, a time series in a table) can't
 * be written. Where the definition tells cases apart by a tag (`kind`, `source` + `request`, a
 * column's `type`), the authoring shape names the case by a key holding its fields, so a rejected
 * input is reported at the field that is wrong rather than once per case.
 */

const report = (context: z.core.$RefinementCtx, issues: string[], path: PropertyKey[] = []) => {
  for (const message of issues) context.addIssue({ code: 'custom', path, message });
};

const keysList = (keys: readonly string[]) => keys.map(key => `\`${key}\``).join(', ');

/** The keys of `value` among `keys` that hold something. */
const keysIn = <K extends string>(value: object, keys: readonly K[]) =>
  keys.filter(key => (value as Record<string, unknown>)[key] !== undefined);

/**
 * Whether exactly one of `keys` holds the case's fields, reporting it when not. Checked before the
 * cases are parsed, so a missing or extra case is reported as such rather than as each case's
 * errors. The keys named are the cases given, or, with none, the keys `fields` doesn't have: a
 * read written where it isn't allowed.
 */
const hasOneKey = (
  input: object,
  keys: readonly string[],
  fields: readonly string[],
  what: string,
  context: z.core.$RefinementCtx,
) => {
  const given = keysIn(input, keys);
  if (given.length === 1) return true;
  const wrong = given.length ? given : Object.keys(input).filter(key => !fields.includes(key));
  context.addIssue({
    code: 'custom',
    path: given.slice(1),
    message: `${what} takes exactly one of ${keysList(keys)}${wrong.length ? `, not ${keysList(wrong)}` : ''}`,
  });
  return false;
};

/**
 * `schema`, an object with one optional key per case, parsed only once exactly one of `keys` holds
 * the case's fields. Typed as `T`, the union of one-key objects that check leaves.
 */
const oneKeyOf = <T>(keys: readonly string[], what: string, schema: z.ZodObject): z.ZodType<T> => {
  const fields = Object.keys(schema.shape);
  return z.preprocess((input, context) => {
    if (!input || typeof input !== 'object' || hasOneKey(input, keys, fields, what, context)) return input;
    return z.NEVER;
  }, schema) as unknown as z.ZodType<T>;
};

/** The fields of an object schema, without `omit`. */
const fieldsOf = (schema: z.ZodObject, omit: readonly string[]) =>
  Object.fromEntries(Object.entries(schema.shape).filter(([key]) => !omit.includes(key)));

/** Canonical JSON: the same for objects that differ only in key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

/** What the project records, so the input schema can list it rather than leave it to a guess. */
export type ObservabilityCatalog = {
  /** The metric names with data, as `MastraClient#getMetricNames` lists them. */
  metricNames?: readonly string[];
};

/** Past this many, metric names stay free strings: a longer list costs more than it guides. */
export const OBSERVABILITY_CATALOG_MAX_METRIC_NAMES = 200;

// An unknown metric name reads as zero rather than failing, so the description names the ones
// Mastra emits.
const METRIC_NAME_DESCRIPTION = [
  'A metric name. Mastra emits `mastra_agent_duration_ms`, `mastra_workflow_duration_ms`, `mastra_tool_duration_ms`,',
  '`mastra_model_duration_ms` and `mastra_processor_duration_ms` (one row per run or call, labelled `status` `ok` or',
  '`error`: `count` them for runs, take percentiles for latency); `mastra_model_total_input_tokens` and',
  '`mastra_model_total_output_tokens` (`sum` them for tokens; read `field: "estimatedCost"` for the price), plus',
  'per-type token metrics such as `mastra_model_input_cache_read_tokens` and `mastra_model_output_reasoning_tokens`.',
  'Projects can emit their own metrics too.',
].join(' ');

const READS = {
  traceAggregate: { source: 'traceAggregate' },
  spanAggregate: { source: 'spanAggregate' },
  metricAggregate: { source: 'metrics', request: 'aggregate' },
  metricBreakdown: { source: 'metrics', request: 'breakdown' },
  metricTimeSeries: { source: 'metrics', request: 'timeSeries' },
  metricPercentiles: { source: 'metrics', request: 'percentiles' },
} as const satisfies Record<string, { source: DashboardQuery['source']; request?: string }>;
type ReadKey = keyof typeof READS;

/** What each place a value sits can read. */
const CHART_READS = [
  'metricTimeSeries',
  'metricPercentiles',
  'traceAggregate',
  'spanAggregate',
] as const satisfies ReadKey[];
const RANGE_READS = [...CHART_READS, 'metricAggregate'] as const satisfies ReadKey[];
const TABLE_READS = ['traceAggregate', 'spanAggregate', 'metricBreakdown'] as const satisfies ReadKey[];
const KPI_READS = ['metricAggregate'] as const satisfies ReadKey[];

/** The fields of a read that pick a number out of its answer rather than change the request. */
const PICKS = ['measure', 'percentile', 'field', 'groups', 'notGroups'] as const;

const isTraceRead = (key: ReadKey) => key === 'traceAggregate' || key === 'spanAggregate';

/** Each read's arguments, with metric names limited to `metricNames` when given. */
const readSchemas = (metricNames?: [string, ...string[]]) => {
  const [traceAggregate, spanAggregate, metrics] = dashboardQuerySchema.out.options;
  const [metricAggregate, metricBreakdown, metricTimeSeries, metricPercentiles] = metrics.options;
  const metricName = (metricNames ? z.enum(metricNames) : z.string().min(1)).meta({
    id: 'MastraMetricName',
    description: METRIC_NAME_DESCRIPTION,
  });
  const names = { name: z.array(metricName).nonempty() };
  const { field, groups, notGroups, percentile } = valueRefSchema.shape;
  const picks = {
    field: field.describe('`value`, or `estimatedCost` for the price. Defaults to `value`.'),
    groups: groups.describe('Only the groups whose key is exactly one of these.'),
    notGroups: notGroups.describe('Only the groups whose key is none of these.'),
    percentile: percentile.unwrap().describe('The percentile to read, e.g. `0.95`.'),
  };
  // Not sent: the page's range sets the interval; a table's or chart's own reads set the sort.
  const omit = ['source', 'request', 'id', 'interval'];
  const measures = traceAggregate.shape.measures as unknown as z.ZodArray<z.ZodType>;
  const traceRead = (source: 'traceAggregate' | 'spanAggregate', query: z.ZodObject) =>
    guardPredicates(
      source,
      z.strictObject({
        ...fieldsOf(query, [...omit, 'measures', 'having', 'orderBy']),
        measure: measures.element.optional().describe('The measure this value reads. Defaults to `count`.'),
        groups: picks.groups,
        notGroups: picks.notGroups,
      }),
    );
  const grouped = (query: z.ZodObject) =>
    (query.shape.groupBy as z.ZodType)
      .optional()
      .describe("The dimensions to group by. In a table, defaults to the table's `groupBy`.");
  return named({
    traceAggregate: traceRead('traceAggregate', traceAggregate),
    spanAggregate: traceRead('spanAggregate', spanAggregate),
    metricAggregate: z.strictObject({ ...fieldsOf(metricAggregate, omit), ...names, field: picks.field }),
    metricBreakdown: z.strictObject({
      ...fieldsOf(metricBreakdown, omit),
      ...names,
      groupBy: grouped(metricBreakdown),
      field: picks.field,
    }),
    metricTimeSeries: z.strictObject({
      ...fieldsOf(metricTimeSeries, omit),
      ...names,
      field: picks.field,
      groups: picks.groups,
      notGroups: picks.notGroups,
    }),
    metricPercentiles: z.strictObject({
      ...fieldsOf(metricPercentiles, [...omit, 'percentiles']),
      name: metricName,
      percentile: picks.percentile,
    }),
  });
};

/** `schemas`, each named, so JSON Schema lists a read's arguments once rather than at every value. */
const named = <T extends Record<ReadKey, z.ZodType>>(schemas: T) =>
  Object.fromEntries(
    Object.entries(schemas).map(([key, schema]) => [
      key,
      schema.meta({ id: `Mastra${key[0]!.toUpperCase()}${key.slice(1)}Read` }),
    ]),
  ) as T;
type ReadSchemas = ReturnType<typeof readSchemas>;

/** `schema`, with an oversized `where` rejected before zod recurses into it, as the definition does. */
const guardPredicates = (source: 'traceAggregate' | 'spanAggregate', schema: z.ZodObject) =>
  z.preprocess((input, context) => {
    if (!input || typeof input !== 'object') return input;
    const guarded = z.safeParse(dashboardQuerySchema.in, { source, ...input });
    if (guarded.success) return input;
    for (const issue of guarded.error.issues) context.addIssue({ ...issue, code: 'custom' });
    return z.NEVER;
  }, schema) as unknown as z.ZodObject;

const OPERATORS = ['const', 'sum', 'minus', 'ratio', 'max', 'coalesce'] as const;
/** The keys of a value column that hold its number rather than its options. */
const TABLE_VALUE_KEYS: readonly string[] = [...TABLE_READS, ...OPERATORS];

/**
 * The keys a value takes, one of which it sets: each read among `reads` holding its arguments, and
 * each operator over `self`, the value nested inside it. `sumOnly` leaves `sum` as the one operator.
 */
const valueCases = (
  schemas: ReadSchemas,
  reads: readonly ReadKey[],
  self: z.ZodType<ObservabilityValue>,
  sumOnly = false,
) => {
  const operators = sumOnly ? (['sum'] as const) : OPERATORS;
  const parts = (description: string) => z.array(self).min(1).optional().describe(description);
  return {
    keys: [...reads, ...operators],
    summary: `a read (${keysList(reads)}) holding its arguments, or ${sumOnly ? '`sum`' : `an operator (${keysList(operators)})`} over values. Reads that differ only in ${keysList(PICKS)} share one request.`,
    shape: {
      ...Object.fromEntries(reads.map(key => [key, schemas[key].optional()])),
      sum: parts('The parts added up; a missing part counts as 0.'),
      ...(sumOnly
        ? {}
        : {
            const: z.number().optional(),
            minus: z.tuple([self, self]).optional().describe('The first minus the second.'),
            ratio: z
              .strictObject({ of: self, over: self })
              .optional()
              .describe('`of / over`; no value when `over` is 0.'),
            max: parts('The largest part that has a value.'),
            coalesce: parts('The first part that has a value.'),
          }),
    },
  };
};

/** A value: exactly one key, a read among `reads` or an operator over values. */
const valueSchema = (
  schemas: ReadSchemas,
  reads: readonly ReadKey[],
  id: string,
  description: string,
  sumOnly = false,
): z.ZodType<ObservabilityValue> => {
  const cases = valueCases(
    schemas,
    reads,
    z.lazy(() => value),
    sumOnly,
  );
  const value: z.ZodType<ObservabilityValue> = oneKeyOf<ObservabilityValue>(
    cases.keys,
    'A value',
    z.strictObject(cases.shape),
  ).meta({ id, description: `${description} Exactly one key: ${cases.summary}` });
  return value;
};

/** The view's reads, gathered into one query each, so identical reads are sent once. */
class Reads {
  readonly queries: DashboardQuery[] = [];
  /** Ids of trace and span aggregates sent over the whole range, which a chart lists as `totals`. */
  readonly wholeRange: string[] = [];
  #byIdentity = new Map<string, DashboardQuery & { measures?: string[]; percentiles?: number[] }>();

  /**
   * The ref reading `read` placed in `place`: `range` sends a trace or span aggregate over the whole
   * range; `table` groups it by `groupBy` unless it sets its own.
   */
  ref(read: ObservabilityRead, place: 'bucket' | 'range' | 'table', groupBy?: string[]): ValueRef {
    const [key] = keysIn(read, Object.keys(READS) as ReadKey[]) as [ReadKey];
    const { measure, percentile, field, groups, notGroups, ...args } = (
      read as unknown as Record<ReadKey, ValueRef & Record<string, unknown>>
    )[key];
    const trace = isTraceRead(key);
    const fillsGroupBy = trace || key === 'metricBreakdown';
    if (groupBy && fillsGroupBy && args.groupBy === undefined) (args as { groupBy?: string[] }).groupBy = groupBy;
    const whole = trace && place === 'range';
    const identity = canonical([key, whole, args]);
    let query = this.#byIdentity.get(identity);
    if (!query) {
      query = {
        ...READS[key],
        id: `q${this.queries.length + 1}`,
        ...args,
        ...(trace ? { measures: [] } : {}),
        ...(percentile === undefined ? {} : { percentiles: [] }),
      } as DashboardQuery & { measures?: string[]; percentiles?: number[] };
      this.#byIdentity.set(identity, query);
      this.queries.push(query);
      if (whole) this.wholeRange.push(query.id!);
    }
    const ref: ValueRef = { query: query.id! };
    if (trace) {
      ref.measure = measure ?? 'count';
      if (!query.measures!.includes(ref.measure)) query.measures!.push(ref.measure);
    }
    if (percentile !== undefined) {
      ref.percentile = percentile;
      if (!query.percentiles!.includes(percentile)) query.percentiles!.push(percentile);
    }
    if (field !== undefined) ref.field = field;
    if (groups !== undefined) ref.groups = groups;
    if (notGroups !== undefined) ref.notGroups = notGroups;
    return ref;
  }

  /** `value` with each read turned into a ref. */
  expr(value: ObservabilityValue, place: 'bucket' | 'range' | 'table', groupBy?: string[]): ValueExpr {
    const recurse = (v: ObservabilityValue) => this.expr(v, place, groupBy);
    if ('const' in value) return { const: value.const };
    if ('sum' in value) return { sum: value.sum.map(recurse) };
    if ('minus' in value) return { minus: [recurse(value.minus[0]), recurse(value.minus[1])] };
    if ('ratio' in value) return { ratio: { of: recurse(value.ratio.of), over: recurse(value.ratio.over) } };
    if ('max' in value) return { max: value.max.map(recurse) };
    if ('coalesce' in value) return { coalesce: value.coalesce.map(recurse) };
    return this.ref(value, place, groupBy);
  }

  /** The queries, a trace or span aggregate no value reads a measure of counting rows. */
  done(): DashboardQuery[] {
    for (const query of this.queries) {
      if ('measures' in query && query.measures?.length === 0) query.measures = ['count'];
    }
    return this.queries;
  }
}

const WIDGET_KINDS = ['kpis', 'timeseries', 'table', 'scores'] as const;
type WidgetKind = (typeof WIDGET_KINDS)[number];

const COLUMN_TYPES = tableColumnOptionsSchema.options.map(option => option.shape.type.value);
type ColumnType = (typeof COLUMN_TYPES)[number];

type Draft = Record<string, unknown>;
type ViewBody = {
  label?: string;
  description?: string;
  tabs?: unknown;
} & Draft;

const viewBase = ({ label, description }: ViewBody) => ({
  ...(label === undefined ? {} : { label }),
  ...(description === undefined ? {} : { description }),
});

const toKpisView = (draft: ObservabilityKpisDraft): DashboardWidgetView => {
  const { label: _l, description: _d, tabs: _t, items, ...options } = draft as ViewBody & ObservabilityKpisDraft;
  const reads = new Reads();
  const converted = items.map(({ value, ...item }) => ({ ...item, value: reads.expr(value, 'range') }));
  return { ...viewBase(draft), queries: reads.done(), options: { ...options, items: converted } };
};

const toTimeseriesView = (draft: ObservabilityTimeseriesDraft): DashboardWidgetView => {
  const {
    label: _l,
    description: _d,
    tabs: _t,
    series,
    total,
    emptyWhenZero,
    ...options
  } = draft as ViewBody & ObservabilityTimeseriesDraft;
  const reads = new Reads();
  const converted = series.map(({ value, rangeTotal, ...line }, i) => ({
    ...line,
    dataKey: `series${i + 1}`,
    value: reads.expr(value, 'bucket'),
    ...(rangeTotal === undefined ? {} : { rangeTotal: reads.expr(rangeTotal, 'range') }),
  }));
  const peaked = converted.find(line => line.emphasis) ?? converted[0]!;
  const totalValue =
    total === undefined
      ? undefined
      : total.value === 'total'
        ? 'total'
        : total.value === 'peak'
          ? { peak: peaked.dataKey }
          : reads.expr(total.value, 'range');
  return {
    ...viewBase(draft),
    queries: reads.done(),
    options: {
      ...options,
      series: converted,
      ...(total === undefined ? {} : { total: { ...total, value: totalValue } }),
      ...(emptyWhenZero === undefined ? {} : { emptyWhenZero: reads.expr(emptyWhenZero, 'range') }),
      ...(reads.wholeRange.length ? { totals: reads.wholeRange } : {}),
    },
  };
};

const columnIds = (columns: ObservabilityColumnDraft[]) => columns.map((column, i) => column.id ?? `column${i + 1}`);
const columnType = (column: ObservabilityColumnDraft) => keysIn(column, COLUMN_TYPES)[0]!;

const toTableView = (draft: ObservabilityTableDraft): DashboardWidgetView => {
  const { label: _l, description: _d, tabs: _t, columns, ...options } = draft as ViewBody & ObservabilityTableDraft;
  const reads = new Reads();
  const ids = columnIds(columns);
  const converted = columns.map((column, i): DashboardColumn => {
    const type = columnType(column);
    const body = (column as Draft)[type] as Draft;
    let typed: Draft = body;
    if (type === 'value') {
      const entries = Object.entries(body);
      const isValueKey = ([key]: [string, unknown]) => TABLE_VALUE_KEYS.includes(key);
      typed = {
        ...Object.fromEntries(entries.filter(entry => !isValueKey(entry))),
        value: reads.expr(
          Object.fromEntries(entries.filter(isValueKey)) as ObservabilityValue,
          'table',
          options.groupBy,
        ),
      };
    }
    return {
      id: ids[i]!,
      ...(column.label === undefined ? {} : { label: column.label }),
      options: { type, ...typed },
    };
  });
  const sorted = columns.findIndex(column => column.sort !== undefined);
  const values = columns.flatMap((column, i) => (columnType(column) === 'value' ? [i] : []));
  const sortBy =
    sorted >= 0 ? sorted : (values.find(i => ((columns[i] as Draft).value as Draft).emphasis) ?? values[0]!);
  return {
    ...viewBase(draft),
    queries: reads.done(),
    columns: converted,
    options: { ...options, defaultSort: { column: ids[sortBy]!, direction: columns[sorted]?.sort ?? 'desc' } },
  };
};

const toScoresView = (draft: ObservabilityScoresDraft): DashboardWidgetView => {
  const {
    label: _l,
    description: _d,
    tabs: _t,
    scorerId,
    scoreSource,
    average,
    series,
    ...options
  } = draft as ViewBody & ObservabilityScoresDraft;
  const scorer = {
    ...(scorerId === undefined ? {} : { scorerId }),
    ...(scoreSource === undefined ? {} : { scoreSource }),
  };
  return {
    ...viewBase(draft),
    queries: [
      { id: 'average', source: 'scores', request: 'aggregate', ...scorer, ...average } as DashboardQuery,
      { id: 'series', source: 'scores', request: 'timeSeries', ...scorer, ...series } as DashboardQuery,
    ],
    options: { ...options, average: 'average', series: 'series' },
  };
};

const TO_VIEW = {
  kpis: toKpisView,
  timeseries: toTimeseriesView,
  table: toTableView,
  scores: toScoresView,
} as Record<WidgetKind, (draft: never) => DashboardWidgetView>;

const toWidget = (draft: ObservabilityWidgetDraft): DashboardWidget => {
  const { kpis, timeseries, table, scores, ...widget } = draft as Omit<ObservabilityWidgetDraft, WidgetKind> &
    Partial<Record<WidgetKind, ViewBody & { tabs?: ViewBody[] }>>;
  const kind = keysIn({ kpis, timeseries, table, scores }, WIDGET_KINDS)[0]!;
  const first = { kpis, timeseries, table, scores }[kind]!;
  const views = [first, ...(first.tabs ?? [])].map(view => TO_VIEW[kind](view as never));
  return { ...widget, id: widget.id ?? crypto.randomUUID(), span: widget.span ?? FULL_WIDTH, kind, views };
};

/** What the draft can say wrong that its schema can't: a table's sort and its `unpricedWhen` column. */
const tableDraftIssues = (draft: ObservabilityTableDraft, context: z.core.$RefinementCtx) => {
  const before = context.issues.length;
  const { columns } = draft;
  const ids = columnIds(columns);
  const valueIds = columns.flatMap((column, i) => (columnType(column) === 'value' ? [ids[i]!] : []));
  if (!valueIds.length) report(context, ['A table needs at least one `value` column'], ['columns']);
  const sorted = columns.flatMap((column, i) => (column.sort === undefined ? [] : [i]));
  if (sorted.length > 1) {
    report(
      context,
      ['At most one column sets `sort`; without one, the table sorts by its emphasized value column'],
      ['columns', sorted[1]!, 'sort'],
    );
  }
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (seen.has(id)) report(context, [`Duplicate column id '${id}'`], ['columns', i, 'id']);
    seen.add(id);
  });
  columns.forEach((column, i) => {
    const unpricedWhen = ((column as Draft).value as Draft | undefined)?.unpricedWhen as string | undefined;
    if (unpricedWhen === undefined || (valueIds.includes(unpricedWhen) && unpricedWhen !== ids[i])) return;
    report(
      context,
      [
        `unpricedWhen names column '${unpricedWhen}', which is not another value column; value column ids are ${keysList(valueIds.filter(id => id !== ids[i]))}`,
      ],
      ['columns', i, 'value', 'unpricedWhen'],
    );
  });
  return context.issues.length === before;
};

const FULL_WIDTH = 12;
const SPAN_DESCRIPTION =
  'Columns of a 12-column row, one of 1, 2, 3, 4, 6 or 12: 12 is the full width, 6 half, 4 a third, 3 a quarter. Left out, the full width.';

const buildWidgetDraftSchema = (catalog: ObservabilityCatalog): z.ZodType<ObservabilityWidgetDraft> => {
  const metricNames = [...new Set(catalog.metricNames)].sort();
  const listed = metricNames.length > 0 && metricNames.length <= OBSERVABILITY_CATALOG_MAX_METRIC_NAMES;
  const reads = readSchemas(listed ? (metricNames as [string, ...string[]]) : undefined);

  const chartValue = valueSchema(reads, CHART_READS, 'MastraChartValue', "A series' number per bucket of the chart.");
  const rangeValue = valueSchema(reads, RANGE_READS, 'MastraRangeValue', 'A number over the whole range.');
  const tableValue = valueSchema(
    reads,
    TABLE_READS,
    'MastraTableValue',
    "A row's number: its reads are grouped by the table's `groupBy` unless they set their own.",
  );
  // A value column's own key is its number; what's nested in an operator is a plain value.
  const tableCases = valueCases(reads, TABLE_READS, tableValue);
  const kpiValue = valueSchema(
    reads,
    KPI_READS,
    'MastraKpiValue',
    'A KPI figure: one aggregate or the sum of several.',
    true,
  );

  const { label, description } = dashboardWidgetViewSchema.shape;
  const viewOf = <T extends Draft>(
    kind: WidgetKind,
    shape: z.ZodRawShape,
    draftIssues: (draft: T, context: z.core.$RefinementCtx) => boolean,
    kindIssues: (view: DashboardWidgetView) => string[],
  ) =>
    z.strictObject({ label, description, ...shape }).superRefine((draft, context) => {
      if (!draftIssues(draft as unknown as T, context)) return;
      const view = TO_VIEW[kind](draft as never);
      if (view.queries.length > DASHBOARD_MAX_QUERIES_PER_VIEW) {
        return report(context, [
          `This view sends ${view.queries.length} requests, past the ${DASHBOARD_MAX_QUERIES_PER_VIEW} a view can send. Reads that differ only in ${keysList(PICKS)} share one.`,
        ]);
      }
      // What the stored view checks across fields, and what its renderer checks: a safety net.
      const checked = dashboardWidgetViewSchema.safeParse(view);
      if (!checked.success)
        return report(
          context,
          checked.error.issues.map(issue => issue.message),
        );
      report(context, [...new Set(kindIssues(view))]);
    });

  const kpiItem = kpisOptionsSchema.shape.items.element as z.ZodObject;
  const kpis = viewOf<ObservabilityKpisDraft>(
    'kpis',
    {
      items: z
        .array(z.strictObject({ ...fieldsOf(kpiItem, ['value']), value: kpiValue }))
        .min(1)
        .describe('One figure each, compared with the window before when its reads set `compare`.'),
    },
    () => true,
    view => kpisIssues(view as never),
  );

  const { total: storedTotal } = timeseriesOptionsSchema.shape;
  const timeseries = viewOf<ObservabilityTimeseriesDraft>(
    'timeseries',
    {
      ...fieldsOf(timeseriesOptionsSchema, ['series', 'totals', 'total', 'emptyWhenZero']),
      series: z
        .array(
          z.strictObject({
            ...fieldsOf(timeseriesSeriesSchema, ['dataKey', 'value', 'rangeTotal']),
            value: chartValue,
            rangeTotal: rangeValue
              .optional()
              .describe("The series' number over the whole range, shown beside the card's title."),
          }),
        )
        .min(1),
      total: z
        .strictObject({
          value: z
            .union([z.enum(['total', 'peak']), rangeValue])
            .describe(
              '`total`: every series summed over the range; `peak`: the highest bucket of the emphasized series (the first, when none is); or a number over the range.',
            ),
          format: (storedTotal.unwrap() as z.ZodObject).shape.format as z.ZodType,
        })
        .optional()
        .describe("The card's total, beside its title. Ignored when a series has a `rangeTotal`."),
      emptyWhenZero: rangeValue
        .optional()
        .describe('Empty when this is zero over the range; by default, when every plotted value is zero.'),
    },
    () => true,
    view => timeseriesIssues(view.options as never, view.queries as never),
  );

  const columnOptions = Object.fromEntries(
    tableColumnOptionsSchema.options.map(option => [option.shape.type.value, option as z.ZodObject]),
  ) as Record<ColumnType, z.ZodObject>;
  const column = oneKeyOf<ObservabilityColumnDraft>(
    COLUMN_TYPES,
    'A column',
    z.strictObject({
      id: z.string().min(1).optional().describe("Needed only for another column's `unpricedWhen` to name it."),
      label: z.string().optional(),
      sort: z
        .enum(['asc', 'desc'])
        .optional()
        .describe('Sorts the table by this column. Without one, it sorts by its emphasized value column, descending.'),
      name: z.strictObject(fieldsOf(columnOptions.name, ['type'])).optional(),
      dimension: z.strictObject(fieldsOf(columnOptions.dimension, ['type', 'query', 'joinOn'])).optional(),
      value: oneKeyOf<Draft>(
        tableCases.keys,
        'A value column',
        z.strictObject({
          ...fieldsOf(columnOptions.value, ['type', 'value']),
          unpricedWhen: (columnOptions.value.shape.unpricedWhen as z.ZodType).describe(
            '`usd` only: the `id` of the column whose value above 0 makes a missing price read "Not priced".',
          ),
          ...tableCases.shape,
        }),
      )
        .optional()
        .describe(
          `The column's options beside the row's number, written as one key: ${tableCases.summary} Its reads are grouped by the table's \`groupBy\` unless they set their own.`,
        ),
      change: z
        .strictObject(fieldsOf(columnOptions.change, ['type']))
        .optional()
        .describe("The emphasized value's % change against the window before; its reads set `compare`."),
    }),
  ).describe(`Exactly one of ${keysList(COLUMN_TYPES)} names the column's type and holds its options.`);
  const table = viewOf<ObservabilityTableDraft>(
    'table',
    { ...fieldsOf(tableOptionsSchema, ['defaultSort', 'rowDrilldown']), columns: z.array(column).min(1) },
    tableDraftIssues,
    view => tableIssues(view.columns as never, view.options as never, view.queries as never),
  );

  const [scoreAggregate, , scoreTimeSeries] = dashboardQuerySchema.out.options[3].options;
  const { scorerId, scoreSource } = scoreAggregate.shape;
  const scores = viewOf<ObservabilityScoresDraft>(
    'scores',
    {
      ...fieldsOf(scoresOptionsSchema, ['average', 'series']),
      scorerId,
      scoreSource,
      average: z
        .strictObject(fieldsOf(scoreAggregate, ['source', 'request', 'id', 'interval', 'scorerId', 'scoreSource']))
        .describe("Each scorer's mean over the range."),
      series: z
        .strictObject(fieldsOf(scoreTimeSeries, ['source', 'request', 'id', 'interval', 'scorerId', 'scoreSource']))
        .describe("Each scorer's line over time."),
    },
    () => true,
    view => scoresIssues(view as never),
  );

  const views = { kpis, timeseries, table, scores } satisfies Record<WidgetKind, z.ZodObject>;
  const { span, title, description: widgetDescription } = dashboardWidgetSchema.shape;
  return oneKeyOf<ObservabilityWidgetDraft>(
    WIDGET_KINDS,
    'A widget',
    z.strictObject({
      id: dashboardWidgetSchema.shape.id.optional().describe('Left out, the server assigns one.'),
      span: (span as z.ZodType).optional().describe(SPAN_DESCRIPTION),
      title,
      description: widgetDescription,
      ...Object.fromEntries(
        WIDGET_KINDS.map(kind => [
          kind,
          views[kind]
            .safeExtend({
              tabs: z
                .array(views[kind])
                .optional()
                .describe('Further views of this kind, drawn as tabs after this one. Leave out for one view.'),
            })
            .optional(),
        ]),
      ),
    }),
  ).describe(`Exactly one of ${keysList(WIDGET_KINDS)} names the widget's kind and holds its view.`);
};

const dashboardDraftSchemaOf = (widget: z.ZodType<ObservabilityWidgetDraft>) =>
  z
    .strictObject({
      schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION).optional(),
      defaults: dashboardDefaultsSchema.optional(),
      rows: z.array(z.strictObject({ widgets: z.array(widget).min(1) })).min(1),
    })
    .superRefine((dashboard, context) => {
      const widgets = dashboard.rows.flatMap(row => row.widgets);
      if (widgets.length > DASHBOARD_MAX_WIDGETS) {
        context.addIssue({ code: 'custom', path: ['rows'], message: `At most ${DASHBOARD_MAX_WIDGETS} widgets` });
      }
      const seen = new Set<string>();
      for (const { id } of widgets) {
        if (id === undefined) continue;
        if (seen.has(id)) context.addIssue({ code: 'custom', path: ['rows'], message: `Duplicate widget id '${id}'` });
        seen.add(id);
      }
    });

// Written out rather than inferred from the schemas: inferred, the published declarations would
// spell out every read and option type once per use.

/** One object per case, holding only that case's key. */
type OneKeyOf<T> = { [K in keyof T]: { [P in K]: T[P] } }[keyof T];

type Args<Q, Omitted extends PropertyKey = never> = Omit<Q, 'source' | 'request' | 'id' | 'interval' | Omitted>;
type MetricQuery<R> = Extract<DashboardQuery, { source: 'metrics'; request: R }>;
type ScoreQuery<R> = Extract<DashboardQuery, { source: 'scores'; request: R }>;
type TraceQuery = Extract<DashboardQuery, { source: 'traceAggregate' }>;
type SpanQuery = Extract<DashboardQuery, { source: 'spanAggregate' }>;
type Field = { field?: 'value' | 'estimatedCost' };
type Groups = { groups?: string[]; notGroups?: string[] };
type TraceArgs<Q extends { measures: unknown[] }> = Args<Q, 'measures' | 'having' | 'orderBy'> & {
  measure?: Q['measures'][number];
} & Groups;

/** Each read's arguments, with what picks the number out of its answer. */
export type ObservabilityReads = {
  traceAggregate: TraceArgs<TraceQuery>;
  spanAggregate: TraceArgs<SpanQuery>;
  metricAggregate: Args<MetricQuery<'aggregate'>> & Field;
  metricBreakdown: Args<MetricQuery<'breakdown'>, 'groupBy'> & { groupBy?: string[] } & Field;
  metricTimeSeries: Args<MetricQuery<'timeSeries'>> & Field & Groups;
  metricPercentiles: Args<MetricQuery<'percentiles'>, 'percentiles'> & { percentile: number };
};

/** One read, named by its key, e.g. `{ metricAggregate: { name: [...], aggregation: 'count' } }`. */
export type ObservabilityRead = OneKeyOf<ObservabilityReads>;

/** A number a view shows: a read, or an operator over values. */
export type ObservabilityValue =
  | ObservabilityRead
  | { const: number }
  | { sum: ObservabilityValue[] }
  | { minus: [ObservabilityValue, ObservabilityValue] }
  | { ratio: { of: ObservabilityValue; over: ObservabilityValue } }
  | { max: ObservabilityValue[] }
  | { coalesce: ObservabilityValue[] };

type ViewDraft = { label?: string; description?: string } & Draft;

export type ObservabilityKpisDraft = ViewDraft & { items: (Draft & { value: ObservabilityValue })[] };

export type ObservabilityTimeseriesDraft = ViewDraft & {
  series: (Draft & { value: ObservabilityValue; rangeTotal?: ObservabilityValue; emphasis?: boolean })[];
  total?: { value: 'total' | 'peak' | ObservabilityValue; format?: string };
  emptyWhenZero?: ObservabilityValue;
};

/**
 * A table column, its type named by the key holding its options. A value column's options sit
 * beside its number, e.g. `{ value: { format: 'count', traceAggregate: { measure: 'count' } } }`.
 */
export type ObservabilityColumnDraft = { id?: string; label?: string; sort?: 'asc' | 'desc' } & OneKeyOf<{
  name: Draft;
  dimension: Draft & { dimension: string };
  value: Draft & ObservabilityValue & { unpricedWhen?: string };
  change: Draft;
}>;

export type ObservabilityTableDraft = ViewDraft & { groupBy: string[]; columns: ObservabilityColumnDraft[] };

export type ObservabilityScoresDraft = ViewDraft &
  Pick<ScoreQuery<'aggregate'>, 'scorerId' | 'scoreSource'> & {
    average: Args<ScoreQuery<'aggregate'>, 'scorerId' | 'scoreSource'>;
    series: Args<ScoreQuery<'timeSeries'>, 'scorerId' | 'scoreSource'>;
  };

type WithTabs<V> = V & { tabs?: V[] };

/**
 * A dashboard widget as the model writes it: its kind is the key holding its view, e.g.
 * `{ span: 6, timeseries: { chart, format, series } }`. Left out, the server assigns the `id` and the
 * widget spans the full row.
 */
export type ObservabilityWidgetDraft = Omit<
  DashboardWidget,
  'id' | 'span' | 'kind' | 'views' | 'scope' | 'drilldown'
> & {
  id?: string;
  span?: DashboardWidget['span'];
} & OneKeyOf<{
    kpis: WithTabs<ObservabilityKpisDraft>;
    timeseries: WithTabs<ObservabilityTimeseriesDraft>;
    table: WithTabs<ObservabilityTableDraft>;
    scores: WithTabs<ObservabilityScoresDraft>;
  }>;

/** A dashboard definition as the model writes it. */
export type ObservabilityDashboardDraft = {
  schemaVersion?: typeof DASHBOARD_SCHEMA_VERSION;
  defaults?: DashboardDefaults;
  rows: { widgets: ObservabilityWidgetDraft[] }[];
};

/** The opening tool's input: the dashboard to draw and the window to draw it over. */
export type ObservabilityDashboardInput = {
  dashboard: ObservabilityDashboardDraft;
  /** Left out, the dashboard's `defaults.datePreset` when it is one of these, else `24h`. */
  datePreset?: ObservabilityDatePreset;
};

/**
 * The input schema of one widget, as written in a dashboard's `rows[].widgets[]`, for a tool that
 * adds a single widget. Metric names are limited to `catalog.metricNames` as in
 * `createObservabilityDashboardInputSchema`. Build it again when the catalog changes: the schema is a
 * snapshot.
 */
export function createObservabilityWidgetInputSchema(
  catalog: ObservabilityCatalog = {},
): z.ZodType<ObservabilityWidgetDraft> {
  return buildWidgetDraftSchema(catalog);
}

/** One widget's input schema, with free metric names; `createObservabilityWidgetInputSchema` lists the project's. */
export const observabilityWidgetInputSchema = createObservabilityWidgetInputSchema();

const dashboardInputSchemaOf = (widget: z.ZodType<ObservabilityWidgetDraft>) =>
  z.object({
    dashboard: dashboardDraftSchemaOf(widget),
    datePreset: z
      .enum(OBSERVABILITY_DATE_PRESETS)
      .optional()
      .describe(
        "The range drawn. Left out, the dashboard's `defaults.datePreset` when it is one of these, else `24h`.",
      ),
  }) as z.ZodType<ObservabilityDashboardInput>;

/**
 * The opening tool's input schema, with metric names limited to `catalog.metricNames`, so the
 * model can only name metrics that have data. With no names, or more than
 * `OBSERVABILITY_CATALOG_MAX_METRIC_NAMES`, metric names stay free strings. Build it again when the
 * catalog changes: the schema is a snapshot.
 */
export function createObservabilityDashboardInputSchema(
  catalog: ObservabilityCatalog = {},
): z.ZodType<ObservabilityDashboardInput> {
  return dashboardInputSchemaOf(createObservabilityWidgetInputSchema(catalog));
}

/**
 * The opening tool's input schema. It spells out each built-in kind's options and checks them as
 * the widget's renderer does, so a model writing the dashboard sees them and gets actionable errors.
 * Metric names are free strings; `createObservabilityDashboardInputSchema` lists the project's.
 */
export const observabilityDashboardInputSchema = dashboardInputSchemaOf(observabilityWidgetInputSchema);

/** The opening tool's output schema, which the app reads as `structuredContent`. */
export const observabilityDashboardOutputSchema: z.ZodType<ObservabilityDashboardOpened> = z.object({
  dashboard: dashboardDefinitionSchema,
  datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
});

export type ObservabilityDashboardOpened = { dashboard: DashboardDefinition; datePreset?: ObservabilityDatePreset };

/**
 * The stored definition for `input`: each value's reads gathered into the view's queries, and every
 * widget without an id given a fresh UUID, so the host can pin each widget by an id that stays the
 * same whenever the result is shown. Throws when `input` doesn't pass
 * `observabilityDashboardInputSchema`, or the definition doesn't validate (e.g. over the size limit).
 */
export function toObservabilityDashboard(input: ObservabilityDashboardInput): ObservabilityDashboardOpened {
  const checked = observabilityDashboardInputSchema.safeParse(input);
  if (!checked.success) throw new Error(`The dashboard is invalid: ${z.prettifyError(checked.error)}`);
  // Converted as given rather than as parsed, so defaults the definition fills on read aren't written in.
  const { dashboard, datePreset } = input;
  const definition: DashboardDefinition = {
    ...dashboard,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    rows: dashboard.rows.map(row => ({ widgets: row.widgets.map(toWidget) })),
  };
  const parsed = dashboardDefinitionSchema.safeParse(definition);
  if (!parsed.success) throw new Error(`The dashboard is invalid: ${z.prettifyError(parsed.error)}`);
  return { dashboard: definition, ...(datePreset ? { datePreset } : {}) };
}

/**
 * The stored widget for `draft`, converted as in `toObservabilityDashboard`: its reads gathered into
 * each view's queries, a fresh UUID when it has no id, and the full width when it has no span.
 * Throws when `draft` doesn't pass `observabilityWidgetInputSchema`, or the widget doesn't validate.
 */
export function toObservabilityWidget(draft: ObservabilityWidgetDraft): DashboardWidget {
  const checked = observabilityWidgetInputSchema.safeParse(draft);
  if (!checked.success) throw new Error(`The widget is invalid: ${z.prettifyError(checked.error)}`);
  const widget = toWidget(draft);
  const parsed = dashboardWidgetSchema.safeParse(widget);
  if (!parsed.success) throw new Error(`The widget is invalid: ${z.prettifyError(parsed.error)}`);
  return widget;
}
