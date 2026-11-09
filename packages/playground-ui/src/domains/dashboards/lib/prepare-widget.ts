import type { DashboardDefinitionEnvelope, DashboardWidget } from '@mastra/client-js';
import { dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import type { AnyWidgetKind, ResolvedView } from '../widget-kind';
import type { DashboardScope } from './definition';
import { inScope, resolveViews } from './resolve-views';
import type { WidgetIssue } from './resolve-views';

export const describeIssue = (issue: WidgetIssue | undefined) =>
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

  const { views, issues } = resolveViews(widget, kind, scope);
  if (issues[0]) return { ok: false, message: describeIssue(issues[0]) };
  const [first, ...rest] = views;
  return first ? { ok: true, kind, widget, views: [first, ...rest] } : { ok: 'hidden' };
}
