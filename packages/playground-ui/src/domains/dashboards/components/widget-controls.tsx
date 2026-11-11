import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { BellPlusIcon } from 'lucide-react';
import { useId } from 'react';
import {
  OpenErrorsInLogsButton,
  OpenInLogsButton,
  OpenInSpansButton,
  OpenInThreadsButton,
  OpenInTracesButton,
} from '../../metrics/components/card-action-buttons';
import { onCardHover } from '../../metrics/components/on-card-hover';
import { viewDrilldown, targetScope } from '../lib/definition';
import type { OnDashboardDrilldown } from '../lib/definition';
import type { DashboardAlert, DashboardAlertAction } from '../widget-kind';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { MetricsCard } from '@/ds/components/MetricsCard';
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
      <MetricsCard.Action label={label} className={onCardHover} render={<LinkComponent href={action.href} />}>
        <BellPlusIcon />
      </MetricsCard.Action>
    );
  }
  return <DisabledAlertAction label={label} reason={action.disabled} />;
}

/** One source's action in a card's alert menu, under the source's label. */
export type AlertEntry = { label: string; action: DashboardAlertAction };

const isLink = (e: AlertEntry): e is { label: string; action: { href: string } } => 'href' in e.action;

/**
 * A card's per-source alert actions. One source, or one the host can link, is a plain button; several
 * open a menu listing every source, each disabled one with its reason. With none to link, the button
 * is disabled with their reasons.
 */
export function AlertMenu({
  entries,
  label,
  LinkComponent,
}: {
  entries: AlertEntry[];
  label: string;
  LinkComponent: DashboardAlert['LinkComponent'];
}) {
  const links = entries.filter(isLink);
  const [only] = entries;
  if (!only) return null;
  if (entries.length === 1) return <AlertAction action={only.action} label={label} LinkComponent={LinkComponent} />;
  if (links.length === 0) {
    const reasons = entries.map(e => ('disabled' in e.action ? e.action.disabled : ''));
    const reason =
      new Set(reasons).size === 1 ? (reasons[0] ?? '') : entries.map((e, i) => `${e.label}: ${reasons[i]}`).join('\n');
    return <DisabledAlertAction label={label} reason={reason} />;
  }
  const [link] = links;
  if (links.length === 1 && link) {
    return <AlertAction action={link.action} label={`Create alert from ${link.label}`} LinkComponent={LinkComponent} />;
  }
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" tooltip={label} aria-label={label} className={onCardHover}>
        <BellPlusIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="max-w-80">
        <DropdownMenu.Label>Create alert from</DropdownMenu.Label>
        {entries.map((entry, i) =>
          'href' in entry.action ? (
            <DropdownMenu.LinkItem key={i} render={<LinkComponent href={entry.action.href} />}>
              {entry.label}
            </DropdownMenu.LinkItem>
          ) : (
            <DropdownMenu.Item key={i} disabled>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{entry.label}</span>
                <span className="text-caption text-placeholder">{entry.action.disabled}</span>
              </div>
            </DropdownMenu.Item>
          ),
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
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
            className={onCardHover}
          >
            <Button variant="ghost" size="icon-sm" disabled aria-hidden="true" tabIndex={-1}>
              <BellPlusIcon />
            </Button>
          </span>
        }
      />
      <TooltipContent id={reasonId} keepMounted className="whitespace-pre-line">
        {reason}
      </TooltipContent>
    </Tooltip>
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
