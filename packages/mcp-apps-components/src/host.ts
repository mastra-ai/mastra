import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  DASHBOARD_PIN_REQUEST_CONTEXT_KEY,
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  dashboardPinnedWidgetsSchema,
} from './apps/dashboard-renderer/pin';

export {
  DASHBOARD_PIN_REQUEST_CONTEXT_KEY,
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
   * not a change: diff it against the host's own state. Entries without `defaults` are widgets you
   * already pinned; keep the defaults you stored for them.
   *
   * Update `pinnedIds` before this returns, or before the promise it returns settles: the app then
   * takes the ids it gets next as your answer, so ids you don't add are pins you turned down.
   */
  onPinnedChange: (pinned: DashboardPinnedWidgetEntry[], app: McpAppRef) => void | Promise<void>;
};

export type McpAppHostOptions = {
  /** Pin widgets from the dashboard-renderer app. */
  dashboardPins?: DashboardPinsHostOptions;
};

const pinRequestSchema = z.number().int();

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
  useLayoutEffect(() => {
    onPinnedChange.current = dashboardPins?.onPinnedChange;
  });
  // The last pin update handled per app instance, by tool call id, sent back so the app knows its
  // clicks were answered even when the ids stay the same.
  const [answeredPins, setAnsweredPins] = useState<Readonly<Record<string, number>>>({});

  return useMemo<McpAppHostValue>(() => {
    if (!pinnedIds) return {};
    return {
      hostContext: app => {
        const ids = pinnedIds(app);
        if (ids === undefined) return undefined;
        const answered = answeredPins[app.toolCallId];
        return {
          [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids,
          ...(answered !== undefined && { [DASHBOARD_PIN_REQUEST_CONTEXT_KEY]: answered }),
        };
      },
      onModelContext: (app, { structuredContent }) => {
        // No key means the update carries no pin state, not that nothing is pinned.
        if (!structuredContent || !(DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in structuredContent)) return;
        // Only apps the host lets pin may change its pins.
        if (pinnedIds(app) == null) return;
        const request = pinRequestSchema.safeParse(structuredContent[DASHBOARD_PIN_REQUEST_CONTEXT_KEY]);
        const answer = () => {
          if (request.success) setAnsweredPins(answered => ({ ...answered, [app.toolCallId]: request.data }));
        };
        const parsed = dashboardPinnedWidgetsSchema.safeParse(structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
        if (!parsed.success) {
          console.error(`[Mastra dashboard] Ignored invalid pinned widgets from "${app.toolName}"`, parsed.error);
          answer();
          return;
        }
        // A promise wrapper so a handler that throws right away still gets reported and answered.
        new Promise<void>(resolve => resolve(onPinnedChange.current?.(parsed.data, app)))
          .catch(error => console.error(`[Mastra dashboard] Couldn't save the pins from "${app.toolName}"`, error))
          .finally(answer);
      },
    };
  }, [pinnedIds, answeredPins]);
}
