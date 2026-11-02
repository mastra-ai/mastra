import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import type { ComponentType } from 'react';
import type { z } from 'zod/v4';
import type { DashboardScope, OnDashboardDrilldown } from './lib/definition';

/** A view whose options passed its kind's schema. */
export type ResolvedView<Options> = DashboardWidgetView & { options: Options };

export type WidgetKindProps<Options> = {
  widget: DashboardWidget;
  /** The views at the page's scope, options parsed. Never empty. */
  views: [ResolvedView<Options>, ...ResolvedView<Options>[]];
  scope: DashboardScope;
  onDrilldown?: OnDashboardDrilldown;
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
