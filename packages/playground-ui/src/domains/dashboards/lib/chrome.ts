import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ChartCardProps } from '../../metrics/components/chart-card';
import type { DashboardExpand } from '../widget-kind';
import { shortViewLabels } from './view-labels';

/**
 * What a widget's card shows in its top bar: `title`, and `tabs` under it with several views, plus
 * its actions: the drilldown, the alert, the expand link, then the host's.
 */
export type ViewHeading = Pick<
  ChartCardProps,
  'title' | 'tabs' | 'dragHandle' | 'onTitleChange' | 'actions' | 'toolbar'
>;

/** Filters a gate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export const unsupportedMessage = (fields: string[], names: Record<string, string> = FILTER_NAMES) =>
  `Not available with a ${fields.map(f => names[f] ?? f).join(' or ')} filter.`;

/** A view's value in the card's tabs: its label in kebab case (`Token usage` → `token-usage`), or its position when unlabelled or blank. */
export const viewValue = (label: string | undefined, index: number) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, '-') : String(index);
};

/** A view's visible name: its label, or `View n` when unlabelled or blank, so every option has an accessible name. */
export const viewLabel = (label: string | undefined, index: number) => label?.trim() || `View ${index + 1}`;

/**
 * The card title for the open view: the widget's title, and with several views, every view a tab
 * under it, named by its short label ("Breakdown by agent" → "Agents"), as the metrics cards switch
 * views. With somewhere to expand to, the title stays plain with no tabs, on the first view, and
 * `ExpandAction` links there.
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
  const labels = shortViewLabels(views.map((v, i) => viewLabel(v.label, i)));
  const options = views.map((v, i) => ({ value: viewValue(v.label, i), label: labels[i] ?? viewLabel(v.label, i) }));
  return {
    title: widget.title ?? '',
    tabs: {
      value: options[index]?.value ?? '',
      onValueChange: (value: string) => onChoose(options.findIndex(o => o.value === value)),
      options,
    },
  };
}
