import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import {
  OpenErrorsInLogsButton,
  OpenInLogsButton,
  OpenInTracesButton,
} from '../../metrics/components/card-action-buttons';
import type { Views } from '../hooks/use-widget-views';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import { tabLabel, tabValue } from '../lib/tabs';
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
          {tabLabel(v.label, i)}
        </MetricsCard.Tab>
      ))}
    </MetricsCard.Tabs>
  );
}

/** The view's action button: open in Traces, or in Logs (naming errors only when the target keeps to them). */
export function DrilldownAction({
  widget,
  view,
  onDrilldown,
}: {
  widget: DashboardWidget;
  view: DashboardWidgetView;
  onDrilldown: OnDashboardDrilldown | undefined;
}) {
  const { action } = viewDrilldown(widget, view);
  if (!onDrilldown || !action) return null;
  const scope = targetScope(action);
  const open = () => onDrilldown(action.page, scope);
  if (action.page !== 'logs') return <OpenInTracesButton onClick={open} />;
  return scope.status === 'error' ? <OpenErrorsInLogsButton onClick={open} /> : <OpenInLogsButton onClick={open} />;
}
