import type { DashboardWidget } from '@mastra/client-js';
import { CardViewTabs } from '../../../metrics/components/card-view-tabs';
import { shortViewLabels } from '../../../metrics/lib/view-labels';
import { viewLabel } from '../../lib/chrome';
import type { ViewHeading } from '../../lib/chrome';
import type { TableOptions } from '../../lib/table';
import type { WidgetKindProps } from '../../widget-kind';

/**
 * A table's heading with several views: the widget's own title, and every view one click away as
 * chips under it (`CardViewTabs`). A single view keeps `heading` as it is.
 */
export function withViewTabs(
  heading: ViewHeading,
  widget: DashboardWidget,
  views: WidgetKindProps<TableOptions>['views'],
  index: number,
  onChoose: (index: number) => void,
): ViewHeading {
  if (views.length < 2) return heading;
  const labels = shortViewLabels(views.map((view, i) => viewLabel(view.label, i)));
  return {
    ...heading,
    title: widget.title ?? '',
    titleMenu: undefined,
    toolbar: (
      <CardViewTabs
        value={String(index)}
        onValueChange={value => onChoose(Number(value))}
        options={labels.map((label, i) => ({ value: String(i), label }))}
      />
    ),
  };
}
