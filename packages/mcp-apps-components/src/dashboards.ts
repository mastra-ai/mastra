import {
  DASHBOARD_SCOPES,
  DASHBOARD_WIDGET_KINDS,
  dashboardDefinitionSchema,
  dashboardWidgetSchema,
} from '@mastra/core/storage/dashboards';
import type {
  DashboardColumn,
  DashboardDefinition,
  DashboardWidget,
  DashboardWidgetView,
} from '@mastra/core/storage/dashboards';
import { tableColumnOptionsSchema } from '@mastra/playground-ui/domains/dashboards/lib/table';
import { z } from 'zod/v4';
import { inScope, KIND_CHECKS, viewIssues } from './dashboard-views';
import type { WidgetIssue } from './dashboard-views';

/*
 * The stored dashboard format, checked as strictly as the dashboard renderer checks it: core's
 * `dashboardDefinitionSchema`, then each widget's kind, each view's options and each table column's
 * options, then what each kind checks beyond its schema (queries an option names, labels, ...).
 *
 * The types are written out here rather than inferred, so this entry's declarations need nothing
 * beyond `@mastra/core` and `zod`; the package's tests check they match the kinds' own schemas.
 */

/** A number read from one of the view's queries, named by its `id`. */
export type DashboardValueRef = {
  query: string;
  field?: 'value' | 'estimatedCost';
  measure?: string;
  percentile?: number;
  groups?: string[];
  notGroups?: string[];
};

/** A number a view shows: a query's value, or a fixed combination of several. */
export type DashboardValueExpr =
  | DashboardValueRef
  | { const: number }
  | { sum: DashboardValueExpr[] }
  | { minus: [DashboardValueExpr, DashboardValueExpr] }
  | { ratio: { of: DashboardValueExpr; over: DashboardValueExpr } }
  | { max: DashboardValueExpr[] }
  | { coalesce: DashboardValueExpr[] };

export type DashboardValueFormat = 'count' | 'usd' | 'duration' | 'percent' | 'score';

export type DashboardChartColor = 'green' | 'sky' | 'violet' | 'teal' | 'indigo' | 'warning' | 'error' | 'neutral';

/** A `kpis` view's options: a row of headline numbers. */
export type DashboardKpisOptions = {
  items: {
    label: string;
    icon: 'bot' | 'coins' | 'hash' | 'threads';
    format: 'count' | 'usd';
    value: DashboardValueExpr;
    detail: string;
    lowerIsBetter?: boolean;
  }[];
};

/** A `table` column's options, told apart by `type`. */
export type DashboardTableColumnOptions =
  | {
      type: 'name';
      as?: 'project';
      unnamed?: string;
      mark?: { icon: 'agent' | 'workflow' | 'tool' } | { providerDimension: string };
      description?: string;
      width?: string;
      sortable?: boolean;
    }
  | {
      type: 'dimension';
      dimension: string;
      as?: 'project';
      query?: string;
      joinOn?: string;
      description?: string;
      width?: string;
      sortable?: boolean;
    }
  | {
      type: 'value';
      value: DashboardValueExpr;
      format: 'count' | 'usd' | 'duration' | 'percent';
      emphasis?: boolean;
      missing?: number;
      additive?: boolean;
      better?: 'higher' | 'lower';
      unpricedWhen?: string;
      description?: string;
      width?: string;
      sortable?: boolean;
    }
  | { type: 'change'; description?: string };

/** A `table` view's options: one row per group. */
export type DashboardTableOptions = {
  groupBy: string[];
  defaultSort: { column: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  emptyMessage: string;
  ariaLabel?: string;
  hideUnnamed?: boolean;
  dropped?: boolean;
  openWhen?: { minRows: number };
  rowDrilldown?: {
    fields: Record<
      string,
      | 'projectId'
      | 'entityName'
      | 'threadId'
      | 'resourceId'
      | 'environment'
      | 'sessionId'
      | 'userId'
      | 'model'
      | 'provider'
    >;
    spanTypes?: string[];
    keepEmpty?: boolean;
  };
};

/** A `timeseries` view's options: values per time bucket as stacked bars or lines. */
export type DashboardTimeseriesOptions = {
  chart: 'stackedBar' | 'line';
  format: DashboardValueFormat;
  axis?: boolean;
  series: {
    dataKey: string;
    label: string;
    color: DashboardChartColor;
    emphasis?: boolean;
    value: DashboardValueExpr;
    rangeTotal?: DashboardValueExpr;
    round?: boolean;
  }[];
  buckets?: 'chart' | 'api';
  totals?: string[];
  hideEmpty?: boolean;
  emphasizeFirst?: boolean;
  xLabels?: 'edges';
  flatYDomain?: [number, number];
  yDomain?: [number, number];
  total?: { value: 'total' | { peak: string } | DashboardValueExpr; format?: DashboardValueFormat };
  /** @deprecated Accepted so saved definitions still parse. */
  emptyMessage?: string;
  emptyWhenZero?: DashboardValueExpr;
};

/** A `scores` view's options: one line per scorer. */
export type DashboardScoresOptions = {
  average: string;
  series: string;
  /** @deprecated Accepted so saved definitions still parse. */
  emptyMessage?: string;
};

/** A table column whose options its kind accepts. */
export type StrictDashboardTableColumn = Omit<DashboardColumn, 'options'> & { options: DashboardTableColumnOptions };

/** A view whose options its kind accepts. Only table views have columns. */
export type StrictDashboardWidgetView<Options, Column = never> = Omit<DashboardWidgetView, 'options' | 'columns'> & {
  options: Options;
  columns?: Column[];
};

type WidgetOf<Kind extends string, Options, Column = never> = Omit<DashboardWidget, 'kind' | 'views'> & {
  kind: Kind;
  views: StrictDashboardWidgetView<Options, Column>[];
};

/** A widget of a built-in kind that the dashboard renderer can draw. */
export type StrictDashboardWidget =
  | WidgetOf<'kpis', DashboardKpisOptions>
  | WidgetOf<'table', DashboardTableOptions, StrictDashboardTableColumn>
  | WidgetOf<'timeseries', DashboardTimeseriesOptions>
  | WidgetOf<'scores', DashboardScoresOptions>;

/** A dashboard definition whose every widget the dashboard renderer can draw. */
export type StrictDashboardDefinition = Omit<DashboardDefinition, 'rows'> & {
  rows: { widgets: StrictDashboardWidget[] }[];
};

type Issue = WidgetIssue;

const isBuiltInKind = (kind: string): kind is keyof typeof KIND_CHECKS => Object.hasOwn(KIND_CHECKS, kind);

const zodIssues = (error: z.ZodError, prefix: PropertyKey[]): Issue[] =>
  error.issues.map(issue => ({ path: [...prefix, ...issue.path], message: issue.message }));

/**
 * What the renderer would reject in a widget core accepts, paths relative to the widget. Every
 * view's options and columns are parsed first; the kind's own checks then run at each scope the
 * widget shows at, as the renderer runs them there. It also rejects columns on views that aren't
 * tables, which the renderer ignores.
 */
function widgetIssues(widget: DashboardWidget): Issue[] {
  if (!isBuiltInKind(widget.kind)) {
    return [
      {
        path: ['kind'],
        message: `Unknown widget kind '${widget.kind}'; expected one of ${DASHBOARD_WIDGET_KINDS.join(', ')}`,
      },
    ];
  }
  const check = KIND_CHECKS[widget.kind];

  const parsed: Issue[] = [];
  for (const [i, view] of widget.views.entries()) {
    const options = check.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) parsed.push(...zodIssues(options.error, ['views', i, 'options']));
    if (!view.columns) continue;
    // The renderer ignores columns on other kinds; rejected so a widget written as another kind isn't stored.
    if (widget.kind !== 'table') {
      parsed.push({ path: ['views', i, 'columns'], message: 'Only table widgets have columns' });
      continue;
    }
    for (const [m, column] of view.columns.entries()) {
      const columnOptions = tableColumnOptionsSchema.safeParse(column.options ?? {});
      if (!columnOptions.success) {
        parsed.push(...zodIssues(columnOptions.error, ['views', i, 'columns', m, 'options']));
      }
    }
  }
  if (parsed.length) return parsed;

  const issues = new Map<string, Issue>();
  for (const scope of DASHBOARD_SCOPES) {
    if (!inScope(widget, scope)) continue;
    for (const issue of viewIssues(widget, check, scope)) {
      issues.set(`${JSON.stringify(issue.path)} ${issue.message}`, issue);
    }
  }
  return [...issues.values()];
}

const report = (ctx: z.RefinementCtx, issues: Issue[], prefix: PropertyKey[] = []) => {
  for (const issue of issues) {
    ctx.addIssue({ code: 'custom', path: [...prefix, ...issue.path], message: issue.message });
  }
};

/**
 * One widget as the dashboard renderer draws it: core's `dashboardWidgetSchema`, a built-in kind,
 * options that kind accepts, and nothing else it would reject, at every scope the widget shows at.
 * Paths are relative to the widget. Unique widget ids, the widget count and the size limit are the
 * definition's to check, so check the whole definition with `strictDashboardDefinitionSchema` too
 * before storing it.
 *
 * Parsing returns the widget as given: no defaults are filled in. It's a validator, not a schema to
 * show a model: its JSON schema is empty. Its input type is `unknown`, so check with it where you
 * store, not in a request schema.
 */
export const strictDashboardWidgetSchema: z.ZodType<StrictDashboardWidget> = z.unknown().superRefine((value, ctx) => {
  const core = dashboardWidgetSchema.safeParse(value);
  if (!core.success) return report(ctx, zodIssues(core.error, []));
  report(ctx, widgetIssues(value as DashboardWidget));
}) as z.ZodType<StrictDashboardWidget>;

/**
 * A dashboard definition as the dashboard renderer draws it: core's `dashboardDefinitionSchema`,
 * then every widget as `strictDashboardWidgetSchema` checks it, paths from the definition (e.g.
 * `rows.0.widgets.1.views.0.options.series.0.value`; problems a kind finds point at the view).
 * Check every definition with it before storing it, so each stored widget renders. Widgets of a
 * host's own kinds are rejected: check those with core's schema.
 *
 * Parsing returns the definition as given: no defaults are filled in. It's a validator, not a
 * schema to show a model: its JSON schema is empty. Its input type is `unknown`, so check with it
 * where you store, not in a request schema.
 */
export const strictDashboardDefinitionSchema: z.ZodType<StrictDashboardDefinition> = z
  .unknown()
  .superRefine((value, ctx) => {
    const core = dashboardDefinitionSchema.safeParse(value);
    if (!core.success) return report(ctx, zodIssues(core.error, []));
    for (const [r, row] of (value as DashboardDefinition).rows.entries()) {
      for (const [w, widget] of row.widgets.entries()) {
        report(ctx, widgetIssues(widget), ['rows', r, 'widgets', w]);
      }
    }
  }) as z.ZodType<StrictDashboardDefinition>;
