import {
  DASHBOARD_MAX_QUERIES_PER_VIEW,
  DASHBOARD_MAX_WIDGETS,
  DASHBOARD_SCHEMA_VERSION,
  dashboardColumnSchema,
  dashboardDefaultsSchema,
  dashboardDefinitionSchema,
  dashboardDrilldownSchema,
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
import { timeseriesIssues, timeseriesOptionsSchema } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import { z } from 'zod/v4';
import { OBSERVABILITY_DATE_PRESETS } from './apps/observability-widget/tool';
import type { ObservabilityDatePreset } from './apps/observability-widget/tool';

const report = (context: z.core.$RefinementCtx, issues: string[]) => {
  for (const message of issues) context.addIssue({ code: 'custom', message });
};

const reportAt = (context: z.core.$RefinementCtx, prefix: PropertyKey[], error: z.ZodError) => {
  for (const issue of error.issues) {
    context.addIssue({ code: 'custom', path: [...prefix, ...issue.path], message: issue.message });
  }
};

/*
 * The model writes a dashboard in an authoring shape that `toObservabilityDashboard` turns into the
 * stored definition, field for field. Where the definition tells cases apart by a tag (`kind`,
 * `source` + `request`, a column's `type`), the authoring shape names the case by a key holding its
 * fields instead, e.g. `{ timeseries: { queries, options } }`. Such keys sit in one object rather
 * than a union, so a rejected input is reported at the field that is wrong rather than once per case.
 */

const QUERY_READS = {
  traceAggregate: { source: 'traceAggregate' },
  spanAggregate: { source: 'spanAggregate' },
  metricAggregate: { source: 'metrics', request: 'aggregate' },
  metricBreakdown: { source: 'metrics', request: 'breakdown' },
  metricTimeSeries: { source: 'metrics', request: 'timeSeries' },
  metricPercentiles: { source: 'metrics', request: 'percentiles' },
  scoreAggregate: { source: 'scores', request: 'aggregate' },
  scoreBreakdown: { source: 'scores', request: 'breakdown' },
  scoreTimeSeries: { source: 'scores', request: 'timeSeries' },
  scorePercentiles: { source: 'scores', request: 'percentiles' },
} as const satisfies Record<string, { source: DashboardQuery['source']; request?: string }>;
type QueryRead = keyof typeof QUERY_READS;
const QUERY_READ_KEYS = Object.keys(QUERY_READS) as QueryRead[];

const WIDGET_KINDS = ['kpis', 'timeseries', 'table', 'scores'] as const;
type WidgetKind = (typeof WIDGET_KINDS)[number];

const keysList = (keys: readonly string[]) => keys.map(key => `\`${key}\``).join(', ');

/** The keys of `value` among `keys` that hold something. */
const keysIn = <K extends string>(value: object, keys: readonly K[]) =>
  keys.filter(key => (value as Record<string, unknown>)[key] !== undefined);

/**
 * Whether exactly one of `keys` holds the case's fields, reporting it when not. Checked before the
 * cases are parsed, so a missing or extra key is reported as such rather than as each case's errors.
 */
const hasOneKey = (input: object, keys: readonly string[], what: string, context: z.core.$RefinementCtx) => {
  const given = keysIn(input, keys);
  if (given.length === 1) return true;
  context.addIssue({
    code: 'custom',
    path: given.slice(1),
    message: `${what} takes exactly one of ${keysList(keys)}${given.length ? `, not ${keysList(given)}` : ''}`,
  });
  return false;
};

/**
 * `schema`, an object with one optional key per case, parsed only once exactly one of `keys` holds
 * the case's fields. Typed as `T`, the union of one-key objects that check leaves.
 */
const oneKeyOf = <T>(keys: readonly string[], what: string, schema: z.ZodObject): z.ZodType<T> =>
  z.preprocess((input, context) => {
    if (!input || typeof input !== 'object' || hasOneKey(input, keys, what, context)) return input;
    return z.NEVER;
  }, schema) as unknown as z.ZodType<T>;

/** The fields of an object schema, without `omit`. */
const fieldsOf = (schema: z.ZodObject, omit: readonly string[]) =>
  Object.fromEntries(Object.entries(schema.shape).filter(([key]) => !omit.includes(key)));

// Metric names are free strings, and an unknown one reads as zero rather than failing, so the
// description names the ones Mastra emits.
const QUERY_DESCRIPTION = [
  'One read the view draws from: its `id`, which options refer to it by, and exactly one key naming the',
  'read (e.g. `metricAggregate`, `metricTimeSeries`) holding its arguments.',
  'Metrics Mastra emits: `mastra_agent_duration_ms`, `mastra_workflow_duration_ms`, `mastra_tool_duration_ms`,',
  '`mastra_model_duration_ms` and `mastra_processor_duration_ms` (one row per run or call, labelled `status`',
  '`ok` or `error`: `count` them for runs, take percentiles for latency); `mastra_model_total_input_tokens` and',
  '`mastra_model_total_output_tokens` (`sum` them for tokens; read `field: "estimatedCost"` for the price), plus',
  'per-type token metrics such as `mastra_model_input_cache_read_tokens` and `mastra_model_output_reasoning_tokens`.',
  'Projects can emit their own metrics too. A value reads a metrics or scores query whole or by `field`;',
  '`measure` only reads trace and span aggregates.',
].join(' ');

/** What the project records, so the input schema can list it rather than leave it to a guess. */
export type ObservabilityCatalog = {
  /** The metric names with data, as `MastraClient#getMetricNames` lists them. */
  metricNames?: readonly string[];
};

/** Past this many, metric names stay free strings: a longer list costs more than it guides. */
export const OBSERVABILITY_CATALOG_MAX_METRIC_NAMES = 200;

// Named, so JSON Schema lists it once under `$defs` rather than once per widget kind.
const drilldownSchema = dashboardDrilldownSchema.meta({ id: 'MastraDashboardDrilldown' });

/** Each read's definition schema, with metrics `name` narrowed to `metricNames` when given. */
const readSchemas = (metricNames?: [string, ...string[]]) => {
  const [traceAggregate, spanAggregate, metrics, scores] = dashboardQuerySchema.out.options;
  const [metricAggregate, metricBreakdown, metricTimeSeries, metricPercentiles] = metrics.options;
  const [scoreAggregate, scoreBreakdown, scoreTimeSeries, scorePercentiles] = scores.options;
  const name = metricNames && z.enum(metricNames);
  return {
    traceAggregate,
    spanAggregate,
    metricAggregate: name ? metricAggregate.safeExtend({ name: z.array(name).nonempty() }) : metricAggregate,
    metricBreakdown: name ? metricBreakdown.safeExtend({ name: z.array(name).nonempty() }) : metricBreakdown,
    metricTimeSeries: name ? metricTimeSeries.safeExtend({ name: z.array(name).nonempty() }) : metricTimeSeries,
    metricPercentiles: name ? metricPercentiles.safeExtend({ name }) : metricPercentiles,
    scoreAggregate,
    scoreBreakdown,
    scoreTimeSeries,
    scorePercentiles,
  } satisfies Record<QueryRead, z.ZodObject>;
};

const toQuery = (draft: ObservabilityQueryDraft): DashboardQuery => {
  const { id, compare, ...reads } = draft as Record<string, unknown>;
  const [read] = keysIn(reads, QUERY_READ_KEYS);
  return {
    ...QUERY_READS[read!],
    ...(id === undefined ? {} : { id }),
    ...(compare === undefined ? {} : { compare }),
    ...(reads[read!] as object),
  } as DashboardQuery;
};

/** The authoring query: `id` and `compare` beside one key per read. */
const authoringQuerySchema = (reads: ReturnType<typeof readSchemas>) => {
  const { id, compare } = reads.metricAggregate.shape;
  const definition = z.discriminatedUnion('source', [
    reads.traceAggregate,
    reads.spanAggregate,
    z.discriminatedUnion('request', [
      reads.metricAggregate,
      reads.metricBreakdown,
      reads.metricTimeSeries,
      reads.metricPercentiles,
    ]),
    z.discriminatedUnion('request', [
      reads.scoreAggregate,
      reads.scoreBreakdown,
      reads.scoreTimeSeries,
      reads.scorePercentiles,
    ]),
  ]);
  const query = z
    .strictObject({
      id,
      compare,
      ...Object.fromEntries(
        QUERY_READ_KEYS.map(read => [
          read,
          z.strictObject(fieldsOf(reads[read], ['source', 'request', 'id', 'compare'])).optional(),
        ]),
      ),
    })
    // The checks the definition runs across fields, such as distinct group-by columns.
    .superRefine((draft, context) => {
      const checked = definition.safeParse(toQuery(draft as ObservabilityQueryDraft));
      if (!checked.success) reportAt(context, keysIn(draft, QUERY_READ_KEYS), checked.error);
    });
  // An oversized predicate is rejected before zod recurses into it, as the definition does.
  return z.preprocess((input, context) => {
    if (!input || typeof input !== 'object') return input;
    if (!hasOneKey(input, QUERY_READ_KEYS, 'A query', context)) return z.NEVER;
    const [read] = keysIn(input, QUERY_READ_KEYS) as [QueryRead];
    const guarded = z.safeParse(dashboardQuerySchema.in, {
      ...QUERY_READS[read],
      ...(input as Record<string, object>)[read],
    });
    if (guarded.success) return input;
    reportAt(context, [read], guarded.error);
    return z.NEVER;
  }, query);
};

const COLUMN_TYPES = tableColumnOptionsSchema.options.map(option => option.shape.type.value);

const toColumn = ({ options, ...column }: ObservabilityColumnDraft): DashboardColumn => {
  const [type] = keysIn(options, COLUMN_TYPES);
  return { ...column, options: { type, ...(options as Record<string, object>)[type!] } };
};

// Column options name their type by a key holding its fields, as queries name their read.
const columnOptionsSchema = oneKeyOf<ObservabilityColumnDraft['options']>(
  COLUMN_TYPES,
  'Column options',
  z.strictObject(
    Object.fromEntries(
      tableColumnOptionsSchema.options.map(option => [
        option.shape.type.value,
        z.strictObject(fieldsOf(option, ['type'])).optional(),
      ]),
    ),
  ),
).describe(`Exactly one of ${keysList(COLUMN_TYPES)}, holding that column type's options.`);

const toView = (draft: ObservabilityViewDraft): DashboardWidgetView => {
  const { tabs: _tabs, queries, columns, ...view } = draft as ObservabilityViewDraft & { tabs?: unknown };
  return { ...view, queries: queries.map(toQuery), ...(columns ? { columns: columns.map(toColumn) } : {}) };
};

const toWidget = (draft: ObservabilityWidgetDraft): DashboardWidget => {
  const { kpis, timeseries, table, scores, ...widget } = draft as Omit<DashboardWidget, 'id' | 'kind' | 'views'> & {
    id?: string;
  } & Partial<Record<WidgetKind, KindDraft>>;
  const [kind] = keysIn({ kpis, timeseries, table, scores }, WIDGET_KINDS);
  const { tabs = [], ...first } = { kpis, timeseries, table, scores }[kind!]!;
  return { ...widget, id: widget.id ?? crypto.randomUUID(), kind: kind!, views: [first, ...tabs].map(toView) };
};

const buildDashboardDraftSchema = (catalog: ObservabilityCatalog) => {
  const metricNames = [...new Set(catalog.metricNames)].sort();
  const listed = metricNames.length > 0 && metricNames.length <= OBSERVABILITY_CATALOG_MAX_METRIC_NAMES;
  const reads = readSchemas(listed ? (metricNames as [string, ...string[]]) : undefined);
  const querySchema = authoringQuerySchema(reads).meta({ id: 'MastraDashboardQuery', description: QUERY_DESCRIPTION });

  const { label, description, drilldown: _drilldown, scope } = dashboardWidgetViewSchema.shape;
  const viewOf = <Options extends z.ZodType, Extra extends z.ZodRawShape>(
    query: z.ZodType,
    options: Options,
    extra: Extra,
    kindIssues: (view: DashboardWidgetView & { options: z.output<Options> }) => string[],
  ) =>
    z
      .strictObject({
        label,
        description,
        queries: z.array(query).min(1).max(DASHBOARD_MAX_QUERIES_PER_VIEW),
        options,
        drilldown: drilldownSchema.optional(),
        scope,
        ...extra,
      })
      // Checked as the stored view and its renderer check it, e.g. unique query ids and refs to them.
      .superRefine((draft, context) => {
        const view = toView(draft as unknown as ObservabilityViewDraft);
        const checked = dashboardWidgetViewSchema.safeParse(view);
        if (!checked.success) return reportAt(context, [], checked.error);
        // As the renderer does, at each scope the view shows at, without the other scope's columns.
        const scopes = view.scope ? [view.scope] : (['org', 'project'] as const);
        const issues = scopes.flatMap(scope =>
          kindIssues({
            ...view,
            columns: view.columns?.filter(column => column.scope === undefined || column.scope === scope),
          } as DashboardWidgetView & { options: z.output<Options> }),
        );
        report(context, [...new Set(issues)]);
      });

  const tableColumn = dashboardColumnSchema.extend({ options: columnOptionsSchema });
  const views = {
    kpis: viewOf(querySchema, kpisOptionsSchema, {}, view => kpisIssues(view as never)),
    timeseries: viewOf(querySchema, timeseriesOptionsSchema, {}, view =>
      timeseriesIssues(view.options, view.queries as never),
    ).describe("A chart's buckets follow the page's range, so its queries leave `interval` out."),
    table: viewOf(querySchema, tableOptionsSchema, { columns: z.array(tableColumn).min(1) }, view =>
      tableIssues(view.columns as never, view.options, view.queries as never),
    ),
    scores: viewOf(querySchema, scoresOptionsSchema, {}, view => scoresIssues(view as never)),
  } satisfies Record<WidgetKind, z.ZodType>;

  const { span, title, description: widgetDescription, scope: widgetScope } = dashboardWidgetSchema.shape;
  const widgetDraftSchema = oneKeyOf<ObservabilityWidgetDraft>(
    WIDGET_KINDS,
    'A widget',
    z.strictObject({
      /** Left out, the server assigns one. */
      id: dashboardWidgetSchema.shape.id.optional(),
      span,
      title,
      description: widgetDescription,
      drilldown: drilldownSchema.optional(),
      scope: widgetScope,
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
  ).describe(
    `Exactly one of ${keysList(WIDGET_KINDS)} names the widget's kind and holds its view: the queries it reads and that kind's options.`,
  );

  return z
    .strictObject({
      schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION).optional(),
      defaults: dashboardDefaultsSchema.optional(),
      rows: z.array(z.strictObject({ widgets: z.array(widgetDraftSchema).min(1) })).min(1),
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
};

// Written out rather than inferred from the schemas: inferred, the published declarations would
// spell out every query and option type once per use.

/** One object per case, holding only that case's key. */
type OneKeyOf<T> = { [K in keyof T]: { [P in K]: T[P] } }[keyof T];

/**
 * A dashboard query as the model writes it: `id` and `compare` beside one key naming the read,
 * e.g. `{ id: 'runs', metricAggregate: { name: [...], aggregation: 'count' } }`.
 */
export type ObservabilityQueryDraft = Pick<DashboardQuery, 'id' | 'compare'> &
  OneKeyOf<{
    [R in QueryRead]: Omit<Extract<DashboardQuery, (typeof QUERY_READS)[R]>, 'source' | 'request' | 'id' | 'compare'>;
  }>;

/** A table column whose `options` name the column type by a key, e.g. `{ value: { value, format } }`. */
export type ObservabilityColumnDraft = Omit<DashboardColumn, 'options'> & {
  options: Record<string, Record<string, unknown>>;
};

/** A widget view as the model writes it. */
export type ObservabilityViewDraft = Omit<DashboardWidgetView, 'queries' | 'columns'> & {
  queries: ObservabilityQueryDraft[];
  columns?: ObservabilityColumnDraft[];
};

type KindDraft = ObservabilityViewDraft & { tabs?: ObservabilityViewDraft[] };

/**
 * A dashboard widget as the model writes it: its kind is the key holding its view, e.g.
 * `{ span: 6, timeseries: { queries, options } }`. Left out, the server assigns the `id`.
 */
export type ObservabilityWidgetDraft = Omit<DashboardWidget, 'id' | 'kind' | 'views'> & {
  id?: string;
} & OneKeyOf<Record<WidgetKind, KindDraft>>;

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
 * The opening tool's input schema, with metrics reads limited to `catalog.metricNames`, so the
 * model can only name metrics that have data. With no names, or more than
 * `OBSERVABILITY_CATALOG_MAX_METRIC_NAMES`, metric names stay free strings. Build it again when the
 * catalog changes: the schema is a snapshot.
 */
export function createObservabilityDashboardInputSchema(
  catalog: ObservabilityCatalog = {},
): z.ZodType<ObservabilityDashboardInput> {
  return z.object({
    dashboard: buildDashboardDraftSchema(catalog),
    /** Left out, the dashboard's `defaults.datePreset` when it is one of these, else `24h`. */
    datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
  });
}

/**
 * The opening tool's input schema. It spells out each built-in kind's options and checks them as
 * the widget's renderer does, so a model writing the dashboard sees them and gets actionable errors.
 * Metric names are free strings; `createObservabilityDashboardInputSchema` lists the project's.
 */
export const observabilityDashboardInputSchema = createObservabilityDashboardInputSchema();

/** The opening tool's output schema, which the app reads as `structuredContent`. */
export const observabilityDashboardOutputSchema: z.ZodType<ObservabilityDashboardOpened> = z.object({
  dashboard: dashboardDefinitionSchema,
  datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
});

export type ObservabilityDashboardOpened = { dashboard: DashboardDefinition; datePreset?: ObservabilityDatePreset };

/**
 * The stored definition for `input`: each widget, query and column option turned from the
 * authoring shape into the definition's, and every widget without an id given a fresh UUID, so the
 * host can pin each widget by an id that stays the same whenever the result is shown. Throws when `input` doesn't pass `observabilityDashboardInputSchema`, or the
 * definition doesn't validate once the ids are in (e.g. over the size limit).
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
