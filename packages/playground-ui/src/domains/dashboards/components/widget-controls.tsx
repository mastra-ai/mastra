import type { DashboardWidget } from '@mastra/client-js';
import { OpenErrorsInLogsButton, OpenInTracesButton } from '../../metrics/components/card-action-buttons';
import type { Views } from '../hooks/use-widget-views';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import { tabValue } from '../lib/tabs';
import type { ResolvedView } from '../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';

/** The tab list for a widget's toolbar; nothing for a single view. */
export function ViewTabs<Options>({
  views,
  index,
  onChoose,
}: {
  views: Views<Options>;
  index: number;
  onChoose: (index: number) => void;
}) {
  if (views.length < 2) return null;
  const values = views.map((v, i) => tabValue(v.label, i));
  return (
    <MetricsCard.Tabs<string> value={values[index] ?? ''} onValueChange={v => onChoose(values.indexOf(v))}>
      {views.map((v, i) => (
        <MetricsCard.Tab key={values[i]} value={values[i] ?? ''}>
          {v.label ?? values[i]}
        </MetricsCard.Tab>
      ))}
    </MetricsCard.Tabs>
  );
}

/** The view's action button: open in Traces, or errors in Logs. */
export function DrilldownAction<Options>({
  widget,
  view,
  onDrilldown,
}: {
  widget: DashboardWidget;
  view: ResolvedView<Options>;
  onDrilldown: OnDashboardDrilldown | undefined;
}) {
  const { action } = viewDrilldown(widget, view);
  if (!onDrilldown || !action) return null;
  const open = () => onDrilldown(action.page, targetScope(action));
  return action.page === 'logs' ? <OpenErrorsInLogsButton onClick={open} /> : <OpenInTracesButton onClick={open} />;
}
