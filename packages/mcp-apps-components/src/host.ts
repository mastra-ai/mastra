import {
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
} from './apps/observability-widget/tool';
import type { ObservabilityWidgetPin } from './apps/observability-widget/tool';

export {
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
} from './apps/observability-widget/tool';
export type { ObservabilityWidgetPin } from './apps/observability-widget/tool';

/** The MCP App instance a host callback is about: one tool call's app. */
export type McpAppRef = { toolName: string; toolCallId: string; resourceUri: string };

/**
 * What a chat host passes to `McpAppHostProvider` from `@mastra/playground-ui/domains/mcps`. Typed
 * here by shape, so this package doesn't depend on the host's UI package.
 */
export type McpAppHostValue = {
  hostContext?: (app: McpAppRef) => Record<string, unknown> | undefined;
  onModelContext?: (
    app: McpAppRef,
    params: { content?: unknown[]; structuredContent?: Record<string, unknown> },
  ) => void;
};

export type ObservabilityWidgetPinsOptions = {
  /** The `ui://` URI the observability widget app is registered under; other apps are left alone. */
  resourceUri: string;
  /** The ids of the widgets the host has pinned. Pass new ids after `onPin`/`onUnpin` to answer. */
  pinnedIds: readonly string[];
  /** The user pinned `pin.widget` over `pin.datePreset`, under `pin.filters` when it has them. */
  onPin: (pin: Omit<ObservabilityWidgetPin, 'pinned'>, app: McpAppRef) => void;
  /** The user unpinned the widget with this id. */
  onUnpin: (widgetId: string, app: McpAppRef) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The app's pin update, checked by shape only: the widget itself is validated when it's drawn. */
function readPin(structuredContent: Record<string, unknown> | undefined): ObservabilityWidgetPin | undefined {
  const pin = structuredContent?.[OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY];
  if (!isRecord(pin) || typeof pin.pinned !== 'boolean' || typeof pin.datePreset !== 'string') return undefined;
  if (!isRecord(pin.widget) || typeof pin.widget.id !== 'string') return undefined;
  if (pin.filters !== undefined && !Array.isArray(pin.filters)) return undefined;
  return {
    pinned: pin.pinned,
    widget: { ...pin.widget, id: pin.widget.id },
    datePreset: pin.datePreset,
    ...(pin.filters ? { filters: pin.filters } : {}),
  };
}

/**
 * Lets the user pin observability widgets from the chat. The host owns the pinned widgets: it
 * sends their ids to each widget app, and hears each pin and unpin.
 *
 * ```tsx
 * const host = useMemo(
 *   () => observabilityWidgetPins({ resourceUri: 'ui://mastra/observability-widget', pinnedIds, onPin, onUnpin }),
 *   [pinnedIds, onPin, onUnpin],
 * );
 * <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>
 * ```
 *
 * A click shows on the button right away and holds until the host's ids next change, so a host
 * that turns a click down leaves it showing until then.
 */
export function observabilityWidgetPins({
  resourceUri,
  pinnedIds,
  onPin,
  onUnpin,
}: ObservabilityWidgetPinsOptions): McpAppHostValue {
  return {
    hostContext: app =>
      app.resourceUri === resourceUri ? { [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: pinnedIds } : undefined,
    onModelContext: (app, params) => {
      if (app.resourceUri !== resourceUri) return;
      const pin = readPin(params.structuredContent);
      if (!pin) return;
      if (pin.pinned) {
        const { pinned: _pinned, ...pinned } = pin;
        onPin(pinned, app);
      } else onUnpin(pin.widget.id, app);
    },
  };
}
