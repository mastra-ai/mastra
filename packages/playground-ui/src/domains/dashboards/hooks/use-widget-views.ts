import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { useState } from 'react';
import type { DrilldownScope } from '../../metrics/drilldown';
import { viewTitle } from '../lib/chrome';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { DashboardExpand, ResolvedView } from '../widget-kind';

export type Views<Options> = readonly [ResolvedView<Options>, ...ResolvedView<Options>[]];

/**
 * The open view of a widget, `wanted` when it has one (else the first), and the card title for it
 * (`title`, and `titleMenu` with several views, or an expand link with `expand`) to spread into
 * `ChartCard`; picking a view calls `onChoose`.
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
