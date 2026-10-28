import type { DashboardWidget } from '@mastra/client-js';
import { dashboardWidgetSchema } from '@mastra/core/storage';
import type { AnyWidgetKind, ResolvedView } from '../widget-kind';
import { inScope } from './definition';
import type { DashboardScope } from './definition';

type Issue = { path: PropertyKey[]; message: string };
export const describeIssue = (issue: Issue | undefined) =>
  !issue ? 'Invalid.' : issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;

export type PreparedWidget =
  | { ok: true; kind: AnyWidgetKind; views: [ResolvedView<unknown>, ...ResolvedView<unknown>[]] }
  | { ok: false; message: string }
  /** Nothing at the page's scope. */
  | { ok: 'hidden' };

/** Checks one widget against core's schema and its kind's options, keeping the views at `scope`. */
export function prepareWidget(
  widget: DashboardWidget,
  registry: ReadonlyMap<string, AnyWidgetKind>,
  scope: DashboardScope,
): PreparedWidget {
  const kind = registry.get(widget.kind);
  if (!kind) return { ok: false, message: 'This widget needs a newer version.' };
  if (!inScope(widget, scope)) return { ok: 'hidden' };
  const parsed = dashboardWidgetSchema.safeParse(widget);
  if (!parsed.success) return { ok: false, message: describeIssue(parsed.error.issues[0]) };

  const views: ResolvedView<unknown>[] = [];
  for (const [index, view] of widget.views.entries()) {
    if (!inScope(view, scope)) continue;
    const options = kind.optionsSchema.safeParse(view.options ?? {});
    if (!options.success) {
      const issue = options.error.issues[0] ?? { path: [], message: 'Invalid options' };
      return { ok: false, message: describeIssue({ ...issue, path: ['views', index, 'options', ...issue.path] }) };
    }
    const resolved = { ...view, options: options.data };
    const issue = kind.issues?.(resolved)[0];
    if (issue) return { ok: false, message: `views.${index}: ${issue}` };
    views.push(resolved);
  }
  const [first, ...rest] = views;
  return first ? { ok: true, kind, views: [first, ...rest] } : { ok: 'hidden' };
}
