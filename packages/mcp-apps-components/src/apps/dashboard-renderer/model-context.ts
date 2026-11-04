import type { drilldownContext } from './drilldown';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY } from './pin';
import type { DashboardPinnedWidget } from './pin';

type ModelContextText = { type: 'text'; text: string };

/** What a drilldown adds to the dashboard's model context. */
export type DrilldownModelContext = ReturnType<typeof drilldownContext>;

function describePinned(pinned: readonly DashboardPinnedWidget[]): string {
  if (!pinned.length) return 'The user has no widgets of this dashboard pinned.';
  const names = pinned.map(({ widget }) => `"${widget.title ?? widget.id}"`);
  return `The user pinned these widgets of this dashboard: ${names.join(', ')}.`;
}

/**
 * Every model context update the dashboard sends. The host keeps only the latest update, so each
 * one carries all the state the app reports: the last drilldown, and the full list of pinned
 * widgets when the host can pin. Leaving `pinned` out leaves the pin key out, which hosts read as
 * "no pin state", never as "nothing pinned".
 */
export function dashboardModelContext({
  pinned,
  drilldown,
}: {
  pinned?: readonly DashboardPinnedWidget[];
  drilldown?: DrilldownModelContext;
}) {
  const content: ModelContextText[] = [...(drilldown?.content ?? [])];
  const structuredContent: Record<string, unknown> = { ...drilldown?.structuredContent };
  if (pinned) {
    content.push({ type: 'text', text: describePinned(pinned) });
    structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY] = pinned;
  }
  return { content, structuredContent };
}
