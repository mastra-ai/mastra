import type { DashboardQuery, DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { AlertAction, AlertMenu } from '../components/widget-controls';
import type { AlertEntry } from '../components/widget-controls';
import type { DashboardAlert, DashboardAlertAction, DashboardAlertRef, DashboardAlertSource } from '../widget-kind';
import type { ViewHeading } from './chrome';
import { unsupportedMessage } from './chrome';
import type { PendingGate } from './gate';
import { pageQuery } from './requests';
import type { DashboardPageContext } from './requests';
import { exprRefs } from './values';
import type { LabelledValue, ValueRef } from './values';

/** What the open view runs against: the page's filters, or the page filters its aggregates can't apply. */
export type AlertSource =
  | {
      page: DashboardPageContext;
      /** The view's series, columns or KPIs, each becoming the alert's sources. */
      values: LabelledValue[];
    }
  | {
      blocked: string[];
      /** The filter bar's names for `blocked`, as the card names them. */ names?: Record<string, string>;
    };

export const UNSATISFIABLE_ALERT = "The page's filters exclude everything this card shows.";

/** `p95` for 0.95: percentiles as people name them. */
const percentileName = (p: number) => `p${Math.round(p * 1000) / 10}`;

/** What a ref picks from its query, beyond the query itself: `(countDistinct.threadId)`, `(p95)`. */
function refDetail(ref: DashboardAlertRef) {
  const parts = [
    ref.measure,
    ref.field,
    ref.percentile === undefined ? undefined : percentileName(ref.percentile),
    ref.groups?.join(', '),
    ref.notGroups && `not ${ref.notGroups.join(', ')}`,
  ].filter((p): p is string => p !== undefined);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

const refKey = ({ query, measure, field, percentile, groups, notGroups }: ValueRef) =>
  JSON.stringify([query, measure, field, percentile, groups, notGroups]);

/**
 * Each distinct ref the view's values read, labelled: by the label of a value that is just that ref
 * if there is one, else as a part of the first combined value reading it (the value's label, its
 * query and what it picks). In the order the values first read them.
 */
export function alertRefs(values: LabelledValue[]): { label: string; ref: ValueRef }[] {
  const own = new Map<string, string>();
  for (const { label, value } of values) {
    if ('query' in value && !own.has(refKey(value))) own.set(refKey(value), label);
  }
  const seen = new Set<string>();
  return values.flatMap(({ label, value }) =>
    exprRefs(value).flatMap(ref => {
      const key = refKey(ref);
      if (seen.has(key)) return [];
      seen.add(key);
      const { query: _query, ...rest } = ref;
      return [{ label: own.get(key) ?? `${label}: ${ref.query}${refDetail(rest)}`, ref }];
    }),
  );
}

type Located = { label: string; ref: DashboardAlertRef; query: DashboardQuery | 'unsatisfiable' };

/** Each source's action, the host's for those it was asked about, in the view's order. */
function entries(located: Located[], answers: (DashboardAlertAction | undefined)[]): AlertEntry[] {
  let asked = 0;
  return located.flatMap(({ label, query }) => {
    const action: DashboardAlertAction | undefined =
      query === 'unsatisfiable' ? { disabled: UNSATISFIABLE_ALERT } : answers[asked++];
    return action ? [{ label, action }] : [];
  });
}

/**
 * The open view's Create alert button, or nothing without an `alert` host. A view the page's filters
 * block, or contradict, gets a disabled button saying so; otherwise the host decides, for the whole
 * card or per source. A source whose query the page's filters contradict is disabled on its own.
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
  const button = (action: DashboardAlertAction) => (
    <AlertAction action={action} label={label} LinkComponent={alert.LinkComponent} />
  );
  if ('blocked' in source) return button({ disabled: unsupportedMessage(source.blocked, source.names) });
  const page = source.page;
  const queries = view.queries.map(q => pageQuery(q, page));
  const located = alertRefs(source.values).flatMap(({ label, ref }): Located[] => {
    const index = view.queries.findIndex(q => q.id === ref.query);
    const query = queries[index];
    if (query === undefined) return [];
    const { query: _query, ...rest } = ref;
    return [{ label, ref: rest, query }];
  });
  const satisfiable = located.filter((s): s is DashboardAlertSource => s.query !== 'unsatisfiable');
  const contradicted = located.length ? satisfiable.length === 0 : queries.some(q => q === 'unsatisfiable');
  if (contradicted) return button({ disabled: UNSATISFIABLE_ALERT });
  const action = alert.action({
    widget,
    view,
    queries: queries.filter(q => q !== 'unsatisfiable'),
    sources: satisfiable,
  });
  if (!Array.isArray(action)) return action && button(action);
  return <AlertMenu entries={entries(located, action)} label={label} LinkComponent={alert.LinkComponent} />;
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
