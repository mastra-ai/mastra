import type { DashboardQuery, DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ComponentType } from 'react';
import type { z } from 'zod/v4';
import type { ChartCardProps } from '../metrics/components/chart-card';
import type { DashboardScope, OnDashboardDrilldown } from './lib/definition';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

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
  /** The card's Create alert button, for the open view: the host can turn views into alerts. */
  alert?: DashboardAlert;
};

/** What a card's Create alert button watches: its open view, with the page's filters applied. */
export type DashboardAlertTarget = {
  widget: DashboardWidget;
  view: DashboardWidgetView;
  /** The view's queries with the page's filter bar ANDed in (`pageQuery`), without the time window. */
  queries: DashboardQuery[];
};

/** Where the button opens the host's alert editor, or why the view can't become an alert. */
export type DashboardAlertAction = { href: string } | { disabled: string };

/**
 * How a host turns a card's open view into an alert: `action` returns where the button links, a
 * reason it's disabled, or `undefined` for no button. Links render through `LinkComponent`.
 */
export type DashboardAlert = {
  action: (target: DashboardAlertTarget) => DashboardAlertAction | undefined;
  LinkComponent: NonNullable<ChartCardProps['LinkComponent']>;
};

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
 * options against `optionsSchema`, and renders `component`.
 */
export type WidgetKind<Options = unknown> = {
  kind: string;
  /** Each view's `options`, parsed before the widget renders. */
  optionsSchema: z.ZodType<Options>;
  /** Further problems with a view, e.g. options naming a query the view doesn't have. */
  issues?: (view: ResolvedView<Options>) => string[];
  component: ComponentType<WidgetKindProps<Options>>;
};

/** Keeps a kind's options type while it joins a list of kinds of different options. */
export const defineWidgetKind = <Options>(kind: WidgetKind<Options>): WidgetKind<Options> => kind;

/** A registry entry, whatever its options. */
export type AnyWidgetKind = WidgetKind<any>;
