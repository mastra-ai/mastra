import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ChartCardProps } from '../../metrics/components/chart-card';
import type { DashboardExpand } from '../widget-kind';

/**
 * What a widget's card shows in its top bar: `title`, and `titleMenu` with several views or an
 * expand link, plus the widget's own actions (its pin button; always shown once pinned).
 */
export type ViewHeading = Pick<
  ChartCardProps,
  'title' | 'titleMenu' | 'href' | 'LinkComponent' | 'dragHandle' | 'onTitleChange' | 'actions' | 'persistentActions'
>;

/** Filters a gate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export const unsupportedMessage = (fields: string[], names: Record<string, string> = FILTER_NAMES) =>
  `Not available with a ${fields.map(f => names[f] ?? f).join(' or ')} filter.`;

/** A view's value in the card's menu: its label in kebab case (`Token usage` → `token-usage`), or its position when unlabelled or blank. */
export const viewValue = (label: string | undefined, index: number) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, '-') : String(index);
};

/** A view's visible name: its label, or `View n` when unlabelled or blank, so every option has an accessible name. */
export const viewLabel = (label: string | undefined, index: number) => label?.trim() || `View ${index + 1}`;

/**
 * The card title for the open view: the widget's title for a single view; with several, the open
 * view's label, as a menu of every view (as the metrics cards switch views). With somewhere to
 * expand to, the widget's title links there instead.
 */
export function viewTitle(
  widget: DashboardWidget,
  views: readonly DashboardWidgetView[],
  index: number,
  onChoose: (index: number) => void,
  expand?: DashboardExpand,
): ViewHeading {
  const href = expand?.href(widget);
  if (href) {
    // A link needs a name: a blank title falls back to the first view's label.
    const title = widget.title?.trim() ? widget.title : viewLabel(views[0]?.label, 0);
    return { title, href, LinkComponent: expand?.LinkComponent };
  }
  if (views.length < 2) return { title: widget.title ?? '' };
  const options = views.map((v, i) => ({ value: viewValue(v.label, i), label: viewLabel(v.label, i) }));
  return {
    title: options[index]?.label ?? '',
    titleMenu: {
      value: options[index]?.value ?? '',
      onValueChange: (value: string) => onChoose(options.findIndex(o => o.value === value)),
      options,
    },
  };
}
