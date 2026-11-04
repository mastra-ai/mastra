import { useMemo, useRef } from 'react';
import type { z } from 'zod';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY, dashboardPinnedWidgetsSchema } from './apps/dashboard-renderer/pin';

export {
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  dashboardPinnedWidgetSchema,
  dashboardPinnedWidgetsSchema,
} from './apps/dashboard-renderer/pin';

/** The MCP App instance a host callback is about: one tool call's app. */
export type McpAppRef = { toolName: string; toolCallId: string; resourceUri: string };

/**
 * What a chat host passes to `McpAppHostProvider` from `@mastra/playground-ui/domains/mcps` to
 * extend the MCP Apps it renders. Typed here by shape, so this package doesn't depend on the
 * host's UI package.
 */
export type McpAppHostValue = {
  /** Extra host-context keys for this app instance; `theme` stays the viewer's own. */
  hostContext?: (app: McpAppRef) => Record<string, unknown> | undefined;
  /** Raw `ui/update-model-context` params from this app. Untrusted: parse before use. */
  onModelContext?: (
    app: McpAppRef,
    params: { content?: unknown[]; structuredContent?: Record<string, unknown> },
  ) => void;
};

/** A pinned widget as the host receives it, once parsed. */
export type DashboardPinnedWidgetEntry = z.output<typeof dashboardPinnedWidgetsSchema>[number];

export type DashboardPinsHostOptions = {
  /**
   * The ids of the widgets the host has pinned from this app instance (`[]` for none), `null` to
   * turn pinning off for it, or `undefined` for apps that aren't dashboards. Key the ids by
   * `app.toolCallId` when a chat can show more than one dashboard, since widget ids are only unique
   * within one. Pass a new function when the ids change, so the apps get them.
   */
  pinnedIds: (app: McpAppRef) => readonly string[] | null | undefined;
  /**
   * Every widget the user wants pinned from `app`, after each pin or unpin. It is the full list,
   * not a change: diff it against the host's own state.
   */
  onPinnedChange: (pinned: DashboardPinnedWidgetEntry[], app: McpAppRef) => void;
};

export type McpAppHostOptions = {
  /** Pin widgets from the dashboard-renderer app. */
  dashboardPins?: DashboardPinsHostOptions;
};

/**
 * Builds the value for `McpAppHostProvider` from the MCP Apps features a host supports.
 *
 * ```tsx
 * const host = useMcpAppHost({ dashboardPins: { pinnedIds, onPinnedChange } });
 * <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>
 * ```
 */
export function useMcpAppHost({ dashboardPins }: McpAppHostOptions): McpAppHostValue {
  const pinnedIds = dashboardPins?.pinnedIds;
  // The handler only runs on app updates, so a new one shouldn't hand the apps new host context.
  const onPinnedChange = useRef(dashboardPins?.onPinnedChange);
  onPinnedChange.current = dashboardPins?.onPinnedChange;

  return useMemo<McpAppHostValue>(() => {
    if (!pinnedIds) return {};
    return {
      hostContext: app => {
        const ids = pinnedIds(app);
        return ids === undefined ? undefined : { [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids };
      },
      onModelContext: (app, { structuredContent }) => {
        // No key means the update carries no pin state, not that nothing is pinned.
        if (!structuredContent || !(DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in structuredContent)) return;
        // Only apps the host lets pin may change its pins.
        if (pinnedIds(app) == null) return;
        const parsed = dashboardPinnedWidgetsSchema.safeParse(structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
        if (!parsed.success) {
          console.error(`[Mastra dashboard] Ignored invalid pinned widgets from "${app.toolName}"`, parsed.error);
          return;
        }
        onPinnedChange.current?.(parsed.data, app);
      },
    };
  }, [pinnedIds]);
}
