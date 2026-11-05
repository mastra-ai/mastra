import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ReactNode } from 'react';
import type { PendingGate } from '../components/view-gate';
import { AlertAction } from '../components/widget-controls';
import type { DashboardAlert } from '../widget-kind';
import type { ViewHeading } from './chrome';
import { unsupportedMessage } from './chrome';
import { pageQuery } from './requests';
import type { DashboardPageContext } from './requests';

/** What the open view runs against: the page's filters, or the page filters its aggregates can't apply. */
export type AlertSource =
  | { page: DashboardPageContext }
  | {
      blocked: string[];
      /** The filter bar's names for `blocked`, as the card names them. */ names?: Record<string, string>;
    };

export const UNSATISFIABLE_ALERT = "The page's filters exclude everything this card shows.";

/**
 * The open view's Create alert button, or nothing without an `alert` host. A view the page's filters
 * block, or contradict, gets a disabled button saying so; otherwise the host decides.
 */
export function alertAction(
  alert: DashboardAlert | undefined,
  widget: DashboardWidget,
  view: DashboardWidgetView,
  source: AlertSource,
): ReactNode {
  if (!alert) return undefined;
  const name = view.label?.trim() || widget.title?.trim();
  const label = name ? `Create alert from ${name}` : 'Create alert';
  const button = (action: Parameters<typeof AlertAction>[0]['action']) => (
    <AlertAction action={action} label={label} LinkComponent={alert.LinkComponent} />
  );
  if ('blocked' in source) return button({ disabled: unsupportedMessage(source.blocked, source.names) });
  const queries = view.queries.map(q => pageQuery(q, source.page));
  if (queries.some(q => q === 'unsatisfiable')) return button({ disabled: UNSATISFIABLE_ALERT });
  const action = alert.action({ widget, view, queries: queries.filter(q => q !== 'unsatisfiable') });
  return action && button(action);
}

/** `heading` with `action` first among its hover actions, so it sits left of the pin. */
export function withAction(heading: ViewHeading, action: ReactNode): ViewHeading {
  if (!action) return heading;
  return {
    ...heading,
    actions: (
      <>
        {action}
        {heading.actions}
      </>
    ),
  };
}

/** A pending card's heading: a view the page's filters block gets its disabled button, saying so. */
export function pendingHeading(
  heading: ViewHeading,
  gate: PendingGate,
  alert: DashboardAlert | undefined,
  widget: DashboardWidget,
  view: DashboardWidgetView,
): ViewHeading {
  if (gate.status !== 'unsupported-filter') return heading;
  return withAction(heading, alertAction(alert, widget, view, { blocked: gate.unsupportedFields }));
}
