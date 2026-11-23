import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { useState } from 'react';
import type { DrilldownScope } from '../../metrics/drilldown';
import { ViewTabs } from '../components/view-tabs';
import { viewLabel } from '../lib/chrome';
import type { ViewHeading } from '../lib/chrome';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { DashboardExpand, ResolvedView } from '../widget-kind';

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

export type Views<Options> = readonly [ResolvedView<Options>, ...ResolvedView<Options>[]];

/**
 * The open view of a widget, `wanted` when it has one (else the first), and the card heading for it
 * (`title`, and with several views their tabs as `toolbar`, unless the widget has somewhere to
 * `expand` to) to spread into `ChartCard`; picking a view calls `onChoose`.
 */
export function viewMenu<Options>(
  widget: DashboardWidget,
  views: Views<Options>,
  wanted: number,
  onChoose: (index: number) => void,
  expand?: DashboardExpand,
) {
  const index = views[wanted] ? wanted : 0;
  return { view: views[index] ?? views[0], index, heading: viewTitle(widget, views, index, onChoose, expand) };
}

/** `viewMenu` with the open view held here: `defaultIndex` until one is picked. */
export function useViewMenu<Options>(
  widget: DashboardWidget,
  views: Views<Options>,
  defaultIndex = 0,
  expand?: DashboardExpand,
) {
  const [chosen, choose] = useState<number>();
  return viewMenu(widget, views, chosen ?? defaultIndex, choose, expand);
}

/** What clicking a bucket or row opens, with what was clicked; `undefined` when the view has no click target. */
export function useDrilldown(
  widget: DashboardWidget,
  view: DashboardWidgetView,
  onDrilldown: OnDashboardDrilldown | undefined,
) {
  const { click } = viewDrilldown(widget, view);
  if (!onDrilldown || !click) return undefined;
  return (clicked: DrilldownScope) => onDrilldown(click.page, { ...targetScope(click), ...clicked });
}

/** Whether the view has an action button to show (`DrilldownAction`). */
export const hasDrilldownAction = (
  widget: DashboardWidget,
  view: DashboardWidgetView,
  onDrilldown: OnDashboardDrilldown | undefined,
) => onDrilldown !== undefined && viewDrilldown(widget, view).action !== undefined;
