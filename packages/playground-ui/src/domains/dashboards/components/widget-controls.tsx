import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { PinIcon, PinOffIcon } from 'lucide-react';
import {
  OpenErrorsInLogsButton,
  OpenInLogsButton,
  OpenInSpansButton,
  OpenInThreadsButton,
  OpenInTracesButton,
} from '../../metrics/components/card-action-buttons';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { WidgetPin } from '../widget-kind';
import { Button } from '@/ds/components/Button';

/** Pins or unpins the widget; it shows the host's state, not the click. */
export function PinAction({ isPinned, onPin }: WidgetPin) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      tooltip={isPinned ? 'Unpin widget' : 'Pin widget'}
      aria-label={isPinned ? 'Unpin widget' : 'Pin widget'}
      onClick={() => onPin(!isPinned)}
    >
      {isPinned ? <PinOffIcon /> : <PinIcon />}
    </Button>
  );
}

/** The view's action button, named for the page it opens (Logs names errors only when the target keeps to them). */
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
  switch (action.page) {
    case 'traces':
      return <OpenInTracesButton onClick={open} />;
    case 'spans':
      return <OpenInSpansButton onClick={open} />;
    case 'threads':
      return <OpenInThreadsButton onClick={open} />;
    case 'logs':
      return scope.status === 'error' ? <OpenErrorsInLogsButton onClick={open} /> : <OpenInLogsButton onClick={open} />;
  }
}
