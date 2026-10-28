import type { DashboardWidget } from '@mastra/client-js';
import { useState } from 'react';
import { OpenErrorsInLogsButton, OpenInTracesButton } from '../../metrics/components/card-action-buttons';
import type { DrilldownScope } from '../../metrics/drilldown';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { ResolvedView } from '../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';

/** The open view of a widget with tabs, and the tab list for its toolbar. */
export function useViewTabs<Options>(
  views: [ResolvedView<Options>, ...ResolvedView<Options>[]],
  /** The tab open until one is chosen. */
  defaultIndex = 0,
) {
  const [chosen, setIndex] = useState<number>();
  const wanted = chosen ?? defaultIndex;
  const index = views[wanted] ? wanted : 0;
  const view = views[index] ?? views[0];
  const values = views.map((v, i) => tabValue(v.label, i));
  const tabs =
    views.length > 1 ? (
      <MetricsCard.Tabs<string> value={tabValue(view.label, index)} onValueChange={v => setIndex(values.indexOf(v))}>
        {views.map((v, i) => {
          const value = tabValue(v.label, i);
          return (
            <MetricsCard.Tab key={value} value={value}>
              {v.label ?? value}
            </MetricsCard.Tab>
          );
        })}
      </MetricsCard.Tabs>
    ) : undefined;
  return { view, index, tabs, setIndex, values };
}

/** A tab's value: its label in kebab case (`Tokens` → `tokens`). */
export const tabValue = (label: string | undefined, index: number) =>
  label ? label.trim().toLowerCase().replace(/\s+/g, '-') : String(index);

/** The view's drilldowns as callbacks: the action button, and a click with what was clicked. */
export function useDrilldown<Options>(
  widget: DashboardWidget,
  view: ResolvedView<Options>,
  onDrilldown: OnDashboardDrilldown | undefined,
) {
  const { action, click } = viewDrilldown(widget, view);
  const actionButton =
    onDrilldown && action ? (
      action.page === 'logs' ? (
        <OpenErrorsInLogsButton onClick={() => onDrilldown(action.page, targetScope(action))} />
      ) : (
        <OpenInTracesButton onClick={() => onDrilldown(action.page, targetScope(action))} />
      )
    ) : undefined;
  const onClick =
    onDrilldown && click
      ? (clicked: DrilldownScope) => onDrilldown(click.page, { ...targetScope(click), ...clicked })
      : undefined;
  return { actionButton, onClick };
}
