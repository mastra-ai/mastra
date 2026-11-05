import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { BellPlusIcon, PinIcon, PinOffIcon } from 'lucide-react';
import { useId } from 'react';
import {
  OpenErrorsInLogsButton,
  OpenInLogsButton,
  OpenInSpansButton,
  OpenInThreadsButton,
  OpenInTracesButton,
} from '../../metrics/components/card-action-buttons';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { DashboardAlert, DashboardAlertAction, WidgetPin } from '../widget-kind';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

/**
 * Opens the host's alert editor for a view (`href`), or, disabled, says why the view can't become
 * an alert. `label` names the view ("Create alert from Agent runs").
 */
export function AlertAction({
  action,
  label,
  LinkComponent,
}: {
  action: DashboardAlertAction;
  label: string;
  LinkComponent: DashboardAlert['LinkComponent'];
}) {
  if ('href' in action) {
    return (
      <Button variant="ghost" size="icon-sm" tooltip={label} render={<LinkComponent href={action.href} />}>
        <BellPlusIcon />
      </Button>
    );
  }
  return <DisabledAlertAction label={label} reason={action.disabled} />;
}

/**
 * A disabled button takes no pointer events or focus, so its wrapper is the control: named,
 * focused, and described by the reason (the tooltip stays mounted, hidden, for screen readers).
 */
function DisabledAlertAction({ label, reason }: { label: string; reason: string }) {
  const reasonId = useId();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-disabled="true"
            aria-describedby={reasonId}
            className="inline-flex"
          >
            <Button variant="ghost" size="icon-sm" disabled aria-hidden="true" tabIndex={-1}>
              <BellPlusIcon />
            </Button>
          </span>
        }
      />
      <TooltipContent id={reasonId} keepMounted>
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

/** Pins or unpins the widget; it shows the host's state, not the click. */
export function PinAction({ isPinned, onPin, name }: WidgetPin) {
  const label = `${isPinned ? 'Unpin' : 'Pin'} ${name}`;
  return (
    <Button variant="ghost" size="icon-sm" tooltip={label} aria-label={label} onClick={() => onPin(!isPinned)}>
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
