import type { DashboardDefinitionEnvelope, DashboardWidget } from '@mastra/client-js';
import { dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import type { AnyWidgetKind, ResolvedView } from '../widget-kind';
import { viewValue } from './chrome';
import { inScope } from './definition';
import type { DashboardScope } from './definition';

type Issue = { path: PropertyKey[]; message: string };
export const describeIssue = (issue: Issue | undefined) =>
  !issue ? 'Invalid.' : issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;

/** A widget as storage accepts it: only `id`, `kind` and `views` are known before it's parsed. */
export type StoredWidget = DashboardDefinitionEnvelope['rows'][number]['widgets'][number];

export type PreparedWidget =
  | {
      ok: true;
      kind: AnyWidgetKind;
      widget: DashboardWidget;
      views: [ResolvedView<unknown>, ...ResolvedView<unknown>[]];
    }
  | { ok: false; message: string }
  /** Nothing at the page's scope. */
  | { ok: 'hidden' };

/**
 * Whether `stored` is a widget core accepts (`z.input` of its schema). Kinds read it as written, not as
 * parsed, so schema defaults never reach a request.
 */
const isDashboardWidget = (stored: StoredWidget): stored is StoredWidget & DashboardWidget =>
  dashboardWidgetSchema.safeParse(stored).success;

/** Checks one widget against core's schema and its kind's options, keeping the views and columns at `scope`. */
export function prepareWidget(
  stored: StoredWidget,
  registry: ReadonlyMap<string, AnyWidgetKind>,
  scope: DashboardScope,
): PreparedWidget {
  if (!isDashboardWidget(stored)) {
    return { ok: false, message: describeIssue(dashboardWidgetSchema.safeParse(stored).error?.issues[0]) };
  }
  const widget: DashboardWidget = stored;
  // A widget for the other scope stays hidden, whether or not this version knows its kind.
  if (!inScope(widget, scope)) return { ok: 'hidden' };
  const kind = registry.get(widget.kind);
  if (!kind) return { ok: false, message: 'This widget needs a newer version.' };

  const views: ResolvedView<unknown>[] = [];
  const values = new Set<string>();
  for (const [index, view] of widget.views.entries()) {
    if (!inScope(view, scope)) continue;
    const options = kind.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) {
      const issue = options.error.issues[0] ?? { path: [], message: 'Invalid options' };
      return { ok: false, message: describeIssue({ ...issue, path: ['views', index, 'options', ...issue.path] }) };
    }
    // Columns at the other scope are left out before the kind sees them.
    const resolved = { ...view, columns: view.columns?.filter(c => inScope(c, scope)), options: options.data };
    const issue = kind.issues?.(resolved)[0];
    if (issue) return { ok: false, message: `views.${index}: ${issue}` };
    // Each view at the scope is an option in the card's menu, picked by its value; two with one value would leave one unreachable.
    const value = viewValue(view.label, views.length);
    if (values.has(value))
      return { ok: false, message: `views.${index}: another view is already labelled '${view.label ?? value}'` };
    values.add(value);
    views.push(resolved);
  }
  const [first, ...rest] = views;
  return first ? { ok: true, kind, widget, views: [first, ...rest] } : { ok: 'hidden' };
}
