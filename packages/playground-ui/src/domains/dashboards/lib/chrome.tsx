import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ChartCardProps } from '../../metrics/components/chart-card';
import { ViewTabs } from '../components/view-tabs';
import type { DashboardExpand } from '../widget-kind';

/**
 * What a widget's card shows in its top bar: `title`, plus its actions: the drilldown, the alert,
 * the expand link, then the host's. Several views are tabs in its `toolbar`, under the title.
 */
export type ViewHeading = Pick<ChartCardProps, 'title' | 'dragHandle' | 'onTitleChange' | 'actions' | 'toolbar'>;

/** Filters a gate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export const unsupportedMessage = (fields: string[], names: Record<string, string> = FILTER_NAMES) =>
  `Not available with a ${fields.map(f => names[f] ?? f).join(' or ')} filter.`;

/** A view's value in the widget's state: its label in kebab case (`Token usage` → `token-usage`), or its position when unlabelled or blank. */
export const viewValue = (label: string | undefined, index: number) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, '-') : String(index);
};

/** A view's visible name: its label, or `View n` when unlabelled or blank, so every option has an accessible name. */
export const viewLabel = (label: string | undefined, index: number) => label?.trim() || `View ${index + 1}`;

/**
 * The card heading for the open view: the widget's title, with several views as tabs under it
 * (`toolbar`). With somewhere to expand to, the title stays alone instead, and `ExpandAction` links there.
 */
export function viewTitle(
  widget: DashboardWidget,
  views: readonly DashboardWidgetView[],
  index: number,
  onChoose: (index: number) => void,
  expand?: DashboardExpand,
): ViewHeading {
  if (expand?.href(widget)) {
    // The card and its expand link need a name: a blank title falls back to the first view's label.
    return { title: widget.title?.trim() ? widget.title : viewLabel(views[0]?.label, 0) };
  }
  if (views.length < 2) return { title: widget.title ?? '' };
  return {
    title: widget.title ?? '',
    toolbar: <ViewTabs labels={views.map((v, i) => viewLabel(v.label, i))} index={index} onChoose={onChoose} />,
  };
}
