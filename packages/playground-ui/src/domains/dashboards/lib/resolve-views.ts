import type { DashboardWidget } from '@mastra/client-js';
import type { ResolvedView, WidgetKindCheck } from '../widget-kind';
import { viewValue } from './chrome';
import type { DashboardScope } from './definition';

/** Whether a widget, view or column tagged with `scope` shows at the page's scope. */
export const inScope = (item: { scope?: DashboardScope }, scope: DashboardScope) =>
  item.scope === undefined || item.scope === scope;

/** A problem with a widget, its path relative to the widget. */
export type WidgetIssue = { path: PropertyKey[]; message: string };

/**
 * The widget's views at `scope`, checked by `kind`: options parsed, then the kind's own issues, then
 * labels unique. A view with any issue is left out of `views`. Takes a widget core's schema accepts.
 */
export function resolveViews(
  widget: DashboardWidget,
  kind: WidgetKindCheck<any>,
  scope: DashboardScope,
): { views: ResolvedView<unknown>[]; issues: WidgetIssue[] } {
  const views: ResolvedView<unknown>[] = [];
  const issues: WidgetIssue[] = [];
  const values = new Set<string>();
  for (const [index, view] of widget.views.entries()) {
    if (!inScope(view, scope)) continue;
    const options = kind.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) {
      const found = options.error.issues.length ? options.error.issues : [{ path: [], message: 'Invalid options' }];
      issues.push(
        ...found.map(issue => ({ path: ['views', index, 'options', ...issue.path], message: issue.message })),
      );
      continue;
    }
    // Columns at the other scope are left out before the kind sees them.
    const resolved = { ...view, columns: view.columns?.filter(c => inScope(c, scope)), options: options.data };
    const viewIssues: WidgetIssue[] = (kind.issues?.(resolved) ?? []).map(message => ({
      path: ['views', index],
      message,
    }));
    // Each view at the scope is an option in the card's menu, picked by its value; two with one value would leave one unreachable.
    const value = viewValue(view.label, views.length);
    if (values.has(value)) {
      viewIssues.push({ path: ['views', index], message: `another view is already labelled '${view.label ?? value}'` });
    }
    issues.push(...viewIssues);
    if (viewIssues.length) continue;
    values.add(value);
    views.push(resolved);
  }
  return { views, issues };
}
