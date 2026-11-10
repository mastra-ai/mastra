import type { DashboardBuiltInWidgetKind, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import { kpisIssues, kpisOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import { scoresIssues, scoresOptionsSchema } from '@mastra/playground-ui/domains/dashboards/kinds/scores/options';
import { viewValue } from '@mastra/playground-ui/domains/dashboards/lib/chrome';
import { tableIssues, tableOptionsSchema } from '@mastra/playground-ui/domains/dashboards/lib/table';
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
