import {
  getMetricAggregateArgsSchema,
  getMetricBreakdownArgsSchema,
  getMetricPercentilesArgsSchema,
  getMetricTimeSeriesArgsSchema,
  getScoreAggregateArgsSchema,
  getScoreBreakdownArgsSchema,
  getScorePercentilesArgsSchema,
  getScoreTimeSeriesArgsSchema,
  metricsFilterSchema,
  requireDistinctColumnRefinement,
  scoresFilterSchema,
} from '@internal/core/storage';
import { z } from 'zod/v4';
import { dashboardFilterNodeSchema } from './dashboard-filters';
import { spanAggregateQueryObjectSchema } from './span-aggregate';
import { traceAggregateQueryObjectSchema } from './trace-aggregate';
import { findPredicateComplexityIssue, TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE } from './trace-query';

/**
 * Stored definition of a custom dashboard: rows of widgets on a 12-column grid, each widget
 * describing its own queries and presentation.
 *
 * Queries reuse the observability request schemas minus what the page supplies at run time: the
 * time range always, and `interval` for time series (the renderer derives it from the range).
 * The page's filters are intersected with each query's own: `where` is ANDed, and a metrics or scores
 * filter field set by both must agree (arrays intersect). A contradiction yields no data.
 *
 * Core owns the common widget shape and the query sources. A widget's `kind` is any non-empty string
 * and `options` stay opaque here: each kind validates its own options where it renders, so a new kind
 * needs no core change or storage deploy. A new query source is one more entry in the `source` union.
 *
 * Two schemas share the same limits:
 * - `dashboardDefinitionSchema` validates everything; the renderer parses with it.
 * - `dashboardDefinitionEnvelopeSchema` validates only what storage needs (version, limits, unique
 *   widget ids, every widget has `kind` and `views`), so new widget kinds or query fields don't
 *   require the storing service to upgrade.
 */

/** Every version storage accepts; `migrateDashboardDefinition` upgrades each to the current one. */
export const DASHBOARD_SCHEMA_VERSIONS = [1] as const;
export const DASHBOARD_SCHEMA_VERSION = 1 satisfies (typeof DASHBOARD_SCHEMA_VERSIONS)[number];
export const DASHBOARD_MAX_WIDGETS = 20;
export const DASHBOARD_MAX_QUERIES_PER_VIEW = 8;
/** Limit on the UTF-8 size of the JSON-serialized definition. */
export const DASHBOARD_MAX_BYTES = 64 * 1024;
export const DASHBOARD_WIDGET_SPANS = [1, 2, 3, 4, 6, 12] as const;
/** Kinds the built-in renderer ships. Not enforced: `kind` accepts any non-empty string. */
// 'table' is reserved for a future generic table kind.
export const DASHBOARD_WIDGET_KINDS = ['kpis', 'breakdown', 'timeseries', 'scores'] as const;
export const DASHBOARD_SCOPES = ['org', 'project'] as const;
export const DASHBOARD_DRILLDOWN_PAGES = ['traces', 'spans', 'logs', 'threads'] as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Compares each value with the window of equal length right before the page's range. */
const compareSchema = z.literal('previousWindow').optional();

/** Lets options refer to a query by name instead of position. Unique within a view. */
const queryIdSchema = z
  .string()
  .regex(/^[A-Za-z][\w-]*$/, 'Query ids start with a letter and contain only letters, digits, _ or -')
  .optional();

const traceAggregateDashboardQuerySchema = traceAggregateQueryObjectSchema.extend({
  source: z.literal('traceAggregate'),
  id: queryIdSchema,
  compare: compareSchema,
});

const spanAggregateDashboardQuerySchema = spanAggregateQueryObjectSchema.extend({
  source: z.literal('spanAggregate'),
  id: queryIdSchema,
  compare: compareSchema,
});

// The page owns the time range, so a stored query can't set `filters.timestamp`.
const metricsQueryFilters = metricsFilterSchema.omit({ timestamp: true }).strict().optional();
const scoresQueryFilters = scoresFilterSchema.omit({ timestamp: true }).strict().optional();

const metricsSource = { source: z.literal('metrics'), id: queryIdSchema, compare: compareSchema } as const;
const scoresSource = { source: z.literal('scores'), id: queryIdSchema, compare: compareSchema } as const;

// Dashboards state comparison only through `compare`, so the aggregate args' `comparePeriod` is dropped.
const { comparePeriod: _metricComparePeriod, ...metricAggregateShape } = getMetricAggregateArgsSchema.shape;
const { comparePeriod: _scoreComparePeriod, ...scoreAggregateShape } = getScoreAggregateArgsSchema.shape;

// Omitted means every scorer, one series per scorer (discovered at run time).
const optionalScorerId = { scorerId: getScoreAggregateArgsSchema.shape.scorerId.optional() } as const;

const metricsDashboardQuerySchema = z.discriminatedUnion('request', [
  z
    .object({
      ...metricsSource,
      request: z.literal('aggregate'),
      ...metricAggregateShape,
      filters: metricsQueryFilters,
    })
    .strict()
    .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options),
  z
    .object({
      ...metricsSource,
      request: z.literal('breakdown'),
      ...getMetricBreakdownArgsSchema.shape,
      filters: metricsQueryFilters,
    })
    .strict()
    .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options),
  z
    .object({
      ...metricsSource,
      request: z.literal('timeSeries'),
      ...getMetricTimeSeriesArgsSchema.shape,
      interval: getMetricTimeSeriesArgsSchema.shape.interval.optional(),
      filters: metricsQueryFilters,
    })
    .strict()
    .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options),
  z
    .object({
      ...metricsSource,
      request: z.literal('percentiles'),
      ...getMetricPercentilesArgsSchema.shape,
      interval: getMetricPercentilesArgsSchema.shape.interval.optional(),
      filters: metricsQueryFilters,
    })
    .strict(),
]);

const scoresDashboardQuerySchema = z.discriminatedUnion('request', [
  z
    .object({
      ...scoresSource,
      request: z.literal('aggregate'),
      ...scoreAggregateShape,
      ...optionalScorerId,
      filters: scoresQueryFilters,
    })
    .strict(),
  z
    .object({
      ...scoresSource,
      request: z.literal('breakdown'),
      ...getScoreBreakdownArgsSchema.shape,
      ...optionalScorerId,
      filters: scoresQueryFilters,
    })
    .strict(),
  z
    .object({
      ...scoresSource,
      request: z.literal('timeSeries'),
      ...getScoreTimeSeriesArgsSchema.shape,
      interval: getScoreTimeSeriesArgsSchema.shape.interval.optional(),
      ...optionalScorerId,
      filters: scoresQueryFilters,
    })
    .strict(),
  z
    .object({
      ...scoresSource,
      request: z.literal('percentiles'),
      ...getScorePercentilesArgsSchema.shape,
      interval: getScorePercentilesArgsSchema.shape.interval.optional(),
      ...optionalScorerId,
      filters: scoresQueryFilters,
    })
    .strict(),
]);

const dashboardQueryUnionSchema = z.discriminatedUnion('source', [
  traceAggregateDashboardQuerySchema,
  spanAggregateDashboardQuerySchema,
  metricsDashboardQuerySchema,
  scoresDashboardQuerySchema,
]);

// Same guard as the aggregate request schemas: reject oversized predicates before zod recurses.
export const dashboardQuerySchema = z.preprocess((input: z.input<typeof dashboardQueryUnionSchema>, context) => {
  const issuePath = findPredicateComplexityIssue(input, [['where'], ['having']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, dashboardQueryUnionSchema);

// ---------------------------------------------------------------------------
// Shared limits
// ---------------------------------------------------------------------------

const scopeSchema = z.enum(DASHBOARD_SCOPES).optional();

const queriesArraySchema = <T extends z.ZodType>(query: T) => z.array(query).min(1).max(DASHBOARD_MAX_QUERIES_PER_VIEW);

/** The serialized size is measured on the raw input, before defaults are applied. */
const withSizeLimit = <T extends z.ZodType>(schema: T) =>
  z.preprocess((input: z.input<T>, context) => {
    const bytes = new TextEncoder().encode(JSON.stringify(input) ?? '').length;
    if (bytes > DASHBOARD_MAX_BYTES) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: `Dashboard definition is ${bytes} bytes; the limit is ${DASHBOARD_MAX_BYTES}`,
      });
      return z.NEVER;
    }
    return input;
  }, schema);

const refineUniqueIds = (items: readonly { id?: string }[], field: string, label: string, context: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (item.id === undefined) return;
    if (seen.has(item.id)) {
      context.addIssue({ code: 'custom', path: [field, index, 'id'], message: `Duplicate ${label} id '${item.id}'` });
    }
    seen.add(item.id);
  });
};

const refineWidgets = (definition: { rows: { widgets: { id: string }[] }[] }, context: z.RefinementCtx) => {
  const seen = new Set<string>();
  let count = 0;
  definition.rows.forEach((row, rowIndex) => {
    row.widgets.forEach((widget, widgetIndex) => {
      count += 1;
      if (seen.has(widget.id)) {
        context.addIssue({
          code: 'custom',
          path: ['rows', rowIndex, 'widgets', widgetIndex, 'id'],
          message: `Duplicate widget id '${widget.id}'`,
        });
      }
      seen.add(widget.id);
    });
  });
  if (count > DASHBOARD_MAX_WIDGETS) {
    context.addIssue({
      code: 'custom',
      path: ['rows'],
      message: `A dashboard can have at most ${DASHBOARD_MAX_WIDGETS} widgets; found ${count}`,
    });
  }
};

// ---------------------------------------------------------------------------
// Full definition
// ---------------------------------------------------------------------------

export const dashboardColumnSchema = z
  .object({
    /** A measure or dimension key from the view's queries. */
    id: z.string().min(1),
    label: z.string().optional(),
    /** Shown only at this scope. */
    scope: scopeSchema,
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const dashboardDrilldownTargetSchema = z
  .object({
    page: z.enum(DASHBOARD_DRILLDOWN_PAGES),
    /** Added to the page's range (and, for `click`, the clicked row's dimensions) when the drilldown opens. */
    filters: z.array(dashboardFilterNodeSchema).optional(),
  })
  .strict();

export const dashboardDrilldownSchema = z
  .object({
    /** Opened from the widget's action button. */
    action: dashboardDrilldownTargetSchema.optional(),
    /** Opened by clicking a row, bar or point. */
    click: dashboardDrilldownTargetSchema.optional(),
  })
  .strict();

export const dashboardWidgetViewSchema = z
  .object({
    label: z.string().optional(),
    /** Overrides the widget's description. */
    description: z.string().optional(),
    queries: queriesArraySchema(dashboardQuerySchema),
    /** Table widgets only. */
    columns: z.array(dashboardColumnSchema).optional(),
    /** Validated by the widget's kind, not here. */
    options: z.record(z.string(), z.unknown()).optional(),
    /** Overrides the widget's drilldown. */
    drilldown: dashboardDrilldownSchema.optional(),
    /** Shown only at this scope. */
    scope: scopeSchema,
  })
  .strict()
  .superRefine((view, context) => {
    refineUniqueIds(view.queries, 'queries', 'query', context);
    if (view.columns) refineUniqueIds(view.columns, 'columns', 'column', context);
  });

export const dashboardWidgetSchema = z
  .object({
    id: z.string().min(1),
    span: z.literal(DASHBOARD_WIDGET_SPANS),
    /** See `DASHBOARD_WIDGET_KINDS` for the built-in kinds. */
    kind: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    /** Two or more views render as tabs. */
    views: z.array(dashboardWidgetViewSchema).min(1),
    drilldown: dashboardDrilldownSchema.optional(),
    /** Shown only at this scope. */
    scope: scopeSchema,
  })
  .strict();

export const dashboardRowSchema = z.object({ widgets: z.array(dashboardWidgetSchema) }).strict();

export const dashboardDefaultsSchema = z
  .object({
    datePreset: z.string().min(1).optional(),
    filters: z.array(dashboardFilterNodeSchema).optional(),
  })
  .strict();

const dashboardDefinitionObjectSchema = z
  .object({
    /**
     * Adding an optional field doesn't change the version. A breaking change bumps it, adds the old
     * version to `DASHBOARD_SCHEMA_VERSIONS`, and adds an upgrade step to `migrateDashboardDefinition`.
     */
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    /** Used when the page URL doesn't set the range or filters. */
    defaults: dashboardDefaultsSchema.optional(),
    rows: z.array(dashboardRowSchema),
  })
  .strict()
  .superRefine(refineWidgets);

export const dashboardDefinitionSchema = withSizeLimit(dashboardDefinitionObjectSchema);

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

const dashboardDefinitionEnvelopeObjectSchema = z
  .looseObject({
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSIONS),
    rows: z.array(
      z.looseObject({
        widgets: z.array(
          z.looseObject({
            id: z.string().min(1),
            kind: z.string().min(1),
            views: z.array(z.looseObject({ queries: queriesArraySchema(z.unknown()) })).min(1),
          }),
        ),
      }),
    ),
  })
  .superRefine(refineWidgets);

export const dashboardDefinitionEnvelopeSchema = withSizeLimit(dashboardDefinitionEnvelopeObjectSchema);

/**
 * Upgrades a stored definition of any known version to `DASHBOARD_SCHEMA_VERSION`. Parse the result
 * with `dashboardDefinitionSchema`. Version 1 is current, so this returns its input unchanged today.
 */
export function migrateDashboardDefinition(definition: DashboardDefinitionEnvelope): DashboardDefinitionEnvelope {
  switch (definition.schemaVersion) {
    case 1:
      return definition;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardDefinition = z.input<typeof dashboardDefinitionObjectSchema>;
export type NormalizedDashboardDefinition = z.output<typeof dashboardDefinitionObjectSchema>;
export type DashboardDefinitionEnvelope = z.output<typeof dashboardDefinitionEnvelopeObjectSchema>;
export type DashboardRow = z.input<typeof dashboardRowSchema>;
export type DashboardWidget = z.input<typeof dashboardWidgetSchema>;
export type DashboardBuiltInWidgetKind = (typeof DASHBOARD_WIDGET_KINDS)[number];
export type DashboardWidgetView = z.input<typeof dashboardWidgetViewSchema>;
export type DashboardQuery = z.input<typeof dashboardQueryUnionSchema>;
export type NormalizedDashboardQuery = z.output<typeof dashboardQueryUnionSchema>;
export type DashboardColumn = z.input<typeof dashboardColumnSchema>;
export type DashboardDrilldown = z.input<typeof dashboardDrilldownSchema>;
export type DashboardDrilldownTarget = z.input<typeof dashboardDrilldownTargetSchema>;
export type DashboardDefaults = z.input<typeof dashboardDefaultsSchema>;
