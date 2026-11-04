import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
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
