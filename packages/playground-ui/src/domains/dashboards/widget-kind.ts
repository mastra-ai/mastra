import type { DashboardQuery, DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ComponentType } from 'react';
import type { z } from 'zod/v4';
import type { ChartCardProps } from '../metrics/components/chart-card';
import type { DashboardScope, OnDashboardDrilldown } from './lib/definition';
import type { BlockedFields, WidgetGate } from './lib/gate';
import type { DashboardPageContext, DashboardRequest, DashboardResult } from './lib/requests';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';
import type { MetricsTableSort } from '@/ds/components/MetricsTable';

/** A view whose options passed its kind's schema. */
export type ResolvedView<Options> = DashboardWidgetView & { options: Options };

export type WidgetKindProps<Options> = {
  widget: DashboardWidget;
  /** The views at the page's scope, options parsed. Never empty. */
  views: [ResolvedView<Options>, ...ResolvedView<Options>[]];
  scope: DashboardScope;
  onDrilldown?: OnDashboardDrilldown;
  /** Where a chart card expands to; see `DashboardExpand`. */
  expand?: DashboardExpand;
  /** A grip to drag the widget by, shown left of its title: the host is arranging the dashboard. */
  dragHandle?: MetricsCardDragHandleProps;
  /** The widget's pin button, shown with its card's actions: the host can pin widgets. */
  pin?: WidgetPin;
  /** Whether the widget's queries can run on the page, and their page context once they can. */
  gate: ShownGate;
  /** What figures are compared against, e.g. `vs previous 24h`. */
  comparisonLabel: string;
  /** Display name for a project id, when the page spans several projects. */
  projectLabel?: (projectId: string) => string;
  /** What the user picked on the widget, held by the host. */
  state: WidgetState;
  /** Called with the whole next state when the user picks a view, sorts, or compares. */
  onStateChange: (next: WidgetState) => void;
  /** Answers to the kind's `discover` requests, in order. */
  discovered: (DashboardResult | undefined)[];
  /** Answers to the kind's `requests`, in order. */
  results: (DashboardResult | undefined)[];
  /** Asks the host to send the failed requests again. */
  onRetry: () => void;
};

/** A widget's gate when it shows: waiting on, or ready to send, its requests. */
export type ShownGate = Exclude<WidgetGate, { status: 'hidden' }>;

/**
 * What the user picked on a widget: the open view, and a table's sort and the value column its
 * % Change compares. Unset fields take the widget's defaults.
 */
export type WidgetState = { view?: number; sort?: MetricsTableSort; compared?: string };

/** What a kind plans its requests from, once its gate is ready. */
export type WidgetPlanContext<Options> = {
  widget: DashboardWidget;
  views: WidgetKindProps<Options>['views'];
  page: DashboardPageContext;
  blocked: BlockedFields;
  state: WidgetState;
};

/** A kind's requests, in the order its answers come back; `undefined` slots aren't sent. */
export type WidgetRequests = (DashboardRequest | undefined)[];

/** A widget's pinned state, as the host holds it, and the call that asks the host to change it. */
export type WidgetPin = {
  isPinned: boolean;
  /** Called with the state the user asked for. */
  onPin: (isPinned: boolean) => void;
  /** The widget's name in the button's label ("Pin Agent runs"), so each card's button is told apart. */
  name: string;
};

/**
 * Where a chart widget expands to (a host's query page), as the Gateway Overview's cards do: the card
 * shows its title with an expand icon linking there, in place of its views menu, on its first view.
 * `href` returns `undefined` for a widget with nowhere to go; that card keeps its menu.
 */
export type DashboardExpand = {
  href: (widget: DashboardWidget) => string | undefined;
  LinkComponent: NonNullable<ChartCardProps['LinkComponent']>;
};

/**
 * One kind of widget, self-contained: the renderer only looks it up by name, checks each view's
 * options against `optionsSchema`, sends what `discover` then `requests` plan, and renders
 * `component` with the answers. A kind planning neither sends nothing; its component may still fetch
 * on its own (`ViewGate`, `useDashboardRequests`), but then only `DashboardRenderer` can host it.
 */
export type WidgetKind<Options = unknown> = {
  kind: string;
  /** Each view's `options`, parsed before the widget renders. */
  optionsSchema: z.ZodType<Options>;
  /** Further problems with a view, e.g. options naming a query the view doesn't have. */
  issues?: (view: ResolvedView<Options>) => string[];
  /**
   * Shows the widget even when a page filter can't apply to some of its queries: its views say so
   * on their own, checking `blocked` (a table's tabs).
   */
  partial?: boolean;
  /**
   * The queries the page's gates check, given what the user picked. Defaults to every view's, so
   * pick only the views the widget shows: a closed view's trace query mustn't hide an open metrics one.
   */
  gatedQueries?: (views: WidgetPlanContext<Options>['views'], state: WidgetState) => DashboardQuery[];
  /** Requests whose answers decide what `requests` asks (the scorers to chart, a table's opening tab). */
  discover?: (ctx: WidgetPlanContext<Options>) => WidgetRequests;
  /** The requests the widget renders from, given the answers to `discover`. */
  requests?: (ctx: WidgetPlanContext<Options>, discovered: (DashboardResult | undefined)[]) => WidgetRequests;
  component: ComponentType<WidgetKindProps<Options>>;
};

/** Keeps a kind's options type while it joins a list of kinds of different options. */
export const defineWidgetKind = <Options>(kind: WidgetKind<Options>): WidgetKind<Options> => kind;

/** A registry entry, whatever its options. */
export type AnyWidgetKind = WidgetKind<any>;
