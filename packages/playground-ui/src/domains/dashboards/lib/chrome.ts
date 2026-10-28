import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';

/** Filters a gate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export const unsupportedMessage = (fields: string[], names: Record<string, string> = FILTER_NAMES) =>
  `Not available with a ${fields.map(f => names[f] ?? f).join(' or ')} filter.`;

/** The title and description a view shows: the view's description overrides the widget's. */
export const viewHeading = (widget: DashboardWidget, view: DashboardWidgetView) => ({
  title: widget.title ?? '',
  description: view.description ?? widget.description,
});
