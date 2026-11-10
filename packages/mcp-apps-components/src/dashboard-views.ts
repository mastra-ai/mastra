import { DASHBOARD_SCOPES, DASHBOARD_WIDGET_KINDS } from '@mastra/core/storage/dashboards';
import type { DashboardBuiltInWidgetKind, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import { kpisIssues, kpisOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import { scoresIssues, scoresOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/scores/options';
import { viewValue } from '@mastra/playground-ui/domains/dashboards/lib/chrome';
import {
  tableColumnOptionsSchema,
  tableIssues,
  tableOptionsSchema,
} from '@mastra/playground-ui/domains/dashboards/lib/table';
import { timeseriesIssues, timeseriesOptionsSchema } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import type { z } from 'zod/v4';

/*
 * How the dashboard renderer checks a widget's views, without React. The view loop mirrors
 * playground-ui's `prepareWidget`; the parity test keeps the two in step until they share a module.
 */

export type DashboardScope = 'org' | 'project';

/** A view as a kind's checks read it: its options parsed, its columns those at the scope. */
type CheckedView = Omit<DashboardWidgetView, 'options'> & { options: any };

export type KindCheck = { optionsSchema: z.ZodType; issues?: (view: CheckedView) => string[] };

/** A problem with a widget, its path relative to the widget. */
export type WidgetIssue = { path: PropertyKey[]; message: string };

/** How each built-in kind checks a view: the options it accepts, then what it checks beyond them. */
export const KIND_CHECKS: Record<DashboardBuiltInWidgetKind, KindCheck> = {
  kpis: { optionsSchema: kpisOptionsSchema, issues: kpisIssues },
  table: {
    optionsSchema: tableOptionsSchema,
    issues: view => tableIssues(view.columns, view.options, view.queries),
  },
  timeseries: {
    optionsSchema: timeseriesOptionsSchema,
    issues: view => timeseriesIssues(view.options, view.queries),
  },
  scores: { optionsSchema: scoresOptionsSchema, issues: scoresIssues },
};

/** Whether a widget, view or column tagged with `scope` shows at the page's scope. */
export const inScope = (item: { scope?: DashboardScope }, scope: DashboardScope) =>
  item.scope === undefined || item.scope === scope;

/**
 * What the renderer rejects in the widget's views at `scope`, in the order it finds them: options
 * parsed, then the kind's own issues, then labels unique. Takes a widget core's schema accepts.
 * Views in `skipKindChecks` skip the kind's own issues, for callers that already report them.
 */
export function viewIssues(
  widget: DashboardWidget,
  check: KindCheck,
  scope: DashboardScope,
  skipKindChecks: ReadonlySet<number> = new Set(),
): WidgetIssue[] {
  const issues: WidgetIssue[] = [];
  const values = new Set<string>();
  let shown = 0;
  for (const [index, view] of widget.views.entries()) {
    if (!inScope(view, scope)) continue;
    // Every view at the scope is an option in the card's menu, picked by its value; two with one value would
    // leave one unreachable. A view with problems still counts, as the renderer numbers it once they're fixed.
    const value = viewValue(view.label, shown++);
    const repeated = values.has(value);
    values.add(value);

    const options = check.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) {
      const found = options.error.issues.length ? options.error.issues : [{ path: [], message: 'Invalid options' }];
      issues.push(
        ...found.map(issue => ({ path: ['views', index, 'options', ...issue.path], message: issue.message })),
      );
      continue;
    }
    // Columns at the other scope are left out before the kind sees them.
    const resolved = { ...view, columns: view.columns?.filter(c => inScope(c, scope)), options: options.data };
    if (!skipKindChecks.has(index)) {
      issues.push(...(check.issues?.(resolved) ?? []).map(message => ({ path: ['views', index], message })));
    }
    if (repeated) {
      issues.push({ path: ['views', index], message: `another view is already labelled '${view.label ?? value}'` });
    }
  }
  return issues;
}

const isBuiltInKind = (kind: string): kind is keyof typeof KIND_CHECKS => Object.hasOwn(KIND_CHECKS, kind);

export const zodIssues = (error: z.ZodError, prefix: PropertyKey[]): WidgetIssue[] =>
  error.issues.map(issue => ({ path: [...prefix, ...issue.path], message: issue.message }));

/**
 * What the renderer would reject in a widget core accepts, paths relative to the widget. Every
 * view's options and columns are parsed; the kind's own checks then run at each scope the widget
 * shows at, as the renderer runs them there, skipping views whose options or columns don't parse.
 * All problems come back together. It also rejects columns on views that aren't tables, which the
 * renderer ignores.
 */
export function widgetIssues(widget: DashboardWidget): WidgetIssue[] {
  if (!isBuiltInKind(widget.kind)) {
    return [
      {
        path: ['kind'],
        message: `Unknown widget kind '${widget.kind}'; expected one of ${DASHBOARD_WIDGET_KINDS.join(', ')}`,
      },
    ];
  }
  const check = KIND_CHECKS[widget.kind];

  const issues = new Map<string, WidgetIssue>();
  const add = (found: WidgetIssue[]) => {
    for (const issue of found) issues.set(`${JSON.stringify(issue.path)} ${issue.message}`, issue);
  };
  // The table's own checks would report a bad column again, at the view.
  const badColumns = new Set<number>();
  for (const [i, view] of widget.views.entries()) {
    const options = check.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) add(zodIssues(options.error, ['views', i, 'options']));
    if (!view.columns) continue;
    // The renderer ignores columns on other kinds; rejected so a widget written as another kind isn't stored.
    if (widget.kind !== 'table') {
      add([{ path: ['views', i, 'columns'], message: 'Only table widgets have columns' }]);
      continue;
    }
    for (const [m, column] of view.columns.entries()) {
      const columnOptions = tableColumnOptionsSchema.safeParse(column.options ?? {});
      if (!columnOptions.success) {
        add(zodIssues(columnOptions.error, ['views', i, 'columns', m, 'options']));
        badColumns.add(i);
      }
    }
  }

  for (const scope of DASHBOARD_SCOPES) {
    if (inScope(widget, scope)) add(viewIssues(widget, check, scope, badColumns));
  }
  return [...issues.values()];
}
