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
import type { DashboardDefaults, DashboardDefinition, DashboardWidget } from '@mastra/core/storage/dashboards';
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

// Named, so JSON Schema lists them once under `$defs` rather than once per widget kind.
const querySchema = dashboardQuerySchema.meta({ id: 'MastraDashboardQuery' });
const drilldownSchema = dashboardDrilldownSchema.meta({ id: 'MastraDashboardDrilldown' });

const viewSchema = dashboardWidgetViewSchema.safeExtend({
  queries: z.array(querySchema).min(1).max(DASHBOARD_MAX_QUERIES_PER_VIEW),
  drilldown: drilldownSchema.optional(),
});

// Each kind's view spells out that kind's options, checked as the widget's renderer checks them, so
// a model writing the dashboard sees them in the tool's input schema.
const kpisView = viewSchema
  .safeExtend({ options: kpisOptionsSchema })
  .superRefine((view, context) => report(context, kpisIssues(view)));

const timeseriesView = viewSchema
  .safeExtend({ options: timeseriesOptionsSchema })
  .superRefine((view, context) => report(context, timeseriesIssues(view.options, view.queries)));

const tableView = viewSchema
  .safeExtend({
    options: tableOptionsSchema,
    columns: z.array(dashboardColumnSchema.extend({ options: tableColumnOptionsSchema })).min(1),
  })
  .superRefine((view, context) => report(context, tableIssues(view.columns, view.options, view.queries)));

const scoresView = viewSchema
  .safeExtend({ options: scoresOptionsSchema })
  .superRefine((view, context) => report(context, scoresIssues(view)));

const draftWidget = <Kind extends string, View extends z.ZodType>(kind: Kind, view: View) =>
  dashboardWidgetSchema.extend({
    /** Left out, the server assigns one. */
    id: dashboardWidgetSchema.shape.id.optional(),
    kind: z.literal(kind),
    views: z
      .array(view)
      .min(1)
      .describe('Each view carries its own queries and options; more than one view draws as tabs.'),
    drilldown: drilldownSchema.optional(),
  });

// Written out rather than inferred from the schemas below: inferred, the published declarations
// would spell out every query and option type once per use.

/** A dashboard widget with its `id` optional: left out, the server assigns one. */
export type ObservabilityWidgetDraft = Omit<DashboardWidget, 'id'> & { id?: string };

/** A dashboard definition whose widgets may leave out their `id`. */
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

const widgetDraftSchema = z.discriminatedUnion('kind', [
  draftWidget('kpis', kpisView),
  draftWidget('timeseries', timeseriesView),
  draftWidget('table', tableView),
  draftWidget('scores', scoresView),
]);

const dashboardDraftSchema = z
  .object({
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION).optional(),
    defaults: dashboardDefaultsSchema.optional(),
    rows: z.array(z.object({ widgets: z.array(widgetDraftSchema).min(1) }).strict()).min(1),
  })
  .strict()
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

/**
 * The opening tool's input schema. It spells out each built-in kind's options and checks them as
 * the widget's renderer does, so a model writing the dashboard sees them and gets actionable errors.
 */
export const observabilityDashboardInputSchema: z.ZodType<ObservabilityDashboardInput> = z.object({
  dashboard: dashboardDraftSchema,
  /** Left out, the dashboard's `defaults.datePreset` when it is one of these, else `24h`. */
  datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
});

/** The opening tool's output schema, which the app reads as `structuredContent`. */
export const observabilityDashboardOutputSchema: z.ZodType<ObservabilityDashboardOpened> = z.object({
  dashboard: dashboardDefinitionSchema,
  datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
});

export type ObservabilityDashboardOpened = { dashboard: DashboardDefinition; datePreset?: ObservabilityDatePreset };

/**
 * The stored definition for `input`: every widget without an id given a fresh UUID, so the host can
 * pin each widget by an id that stays the same whenever the result is shown. Widgets keep their
 * options as written. Throws when `input` doesn't pass `observabilityDashboardInputSchema`, or the
 * definition doesn't validate once the ids are in (e.g. over the size limit).
 */
export function toObservabilityDashboard(input: ObservabilityDashboardInput): ObservabilityDashboardOpened {
  const checked = observabilityDashboardInputSchema.safeParse(input);
  if (!checked.success) throw new Error(`The dashboard is invalid: ${z.prettifyError(checked.error)}`);
  const { dashboard, datePreset } = input;
  const definition: DashboardDefinition = {
    ...dashboard,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    rows: dashboard.rows.map(row => ({
      widgets: row.widgets.map((widget): DashboardWidget => ({ ...widget, id: widget.id ?? crypto.randomUUID() })),
    })),
  };
  const parsed = dashboardDefinitionSchema.safeParse(definition);
  if (!parsed.success) throw new Error(`The dashboard is invalid: ${z.prettifyError(parsed.error)}`);
  return { dashboard: definition, ...(datePreset ? { datePreset } : {}) };
}
