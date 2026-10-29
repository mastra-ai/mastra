import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { useState } from 'react';
import type { DrilldownScope } from '../../metrics/drilldown';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { ResolvedView } from '../widget-kind';

export type Views<Options> = readonly [ResolvedView<Options>, ...ResolvedView<Options>[]];

/** The open view of a widget with tabs: `defaultIndex` until a tab is chosen. */
export function useViewTabs<Options>(views: Views<Options>, defaultIndex = 0) {
  const [chosen, choose] = useState<number>();
  const wanted = chosen ?? defaultIndex;
  const index = views[wanted] ? wanted : 0;
  return { view: views[index] ?? views[0], index, choose };
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
