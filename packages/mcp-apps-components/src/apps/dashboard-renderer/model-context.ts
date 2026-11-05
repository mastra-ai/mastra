import type { drilldownContext } from './drilldown';
import { DASHBOARD_PIN_REQUEST_CONTEXT_KEY, DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY } from './pin';
import type { DashboardPinnedWidget } from './pin';

type ModelContextText = { type: 'text'; text: string };

/** What a drilldown adds to the dashboard's model context. */
export type DrilldownModelContext = ReturnType<typeof drilldownContext>;

/** What pinning adds to the dashboard's model context: the widgets and the update's request number. */
export type PinsModelContext = { request: number; pinned: readonly DashboardPinnedWidget[] };

function describePinned(pinned: readonly DashboardPinnedWidget[]): string {
  if (!pinned.length) return 'The user has no widgets of this dashboard pinned.';
  const names = pinned.map(({ widget }) => `"${widget.title ?? widget.id}"`);
  return `The user pinned these widgets of this dashboard: ${names.join(', ')}.`;
}

/**
 * Every model context update the dashboard sends. The host keeps only the latest update, so each
 * one carries all the state the app reports: the last drilldown, and the full list of pinned
 * widgets when the host can pin. Leaving `pins` out leaves the pin keys out, which hosts read as
 * "no pin state", never as "nothing pinned".
 */
export function dashboardModelContext({
  pins,
  drilldown,
}: {
  pins?: PinsModelContext;
  drilldown?: DrilldownModelContext;
}) {
  const content: ModelContextText[] = [...(drilldown?.content ?? [])];
  const structuredContent: Record<string, unknown> = { ...drilldown?.structuredContent };
  if (pins) {
    content.push({ type: 'text', text: describePinned(pins.pinned) });
    structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY] = pins.pinned;
    structuredContent[DASHBOARD_PIN_REQUEST_CONTEXT_KEY] = pins.request;
  }
  return { content, structuredContent };
}
