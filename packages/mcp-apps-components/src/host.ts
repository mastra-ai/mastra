import {
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY,
} from './apps/observability-widget/tool';
import type {
  ObservabilityWidgetDateRange,
  ObservabilityWidgetPin,
  ObservabilityWidgetView,
} from './apps/observability-widget/tool';

export {
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY,
} from './apps/observability-widget/tool';
export type {
  ObservabilityWidgetDateRange,
  ObservabilityWidgetPin,
  ObservabilityWidgetView,
} from './apps/observability-widget/tool';

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

export type ObservabilityWidgetPins = {
  /** The ids of the widgets the host has pinned. Pass new ids after `onPin`/`onUnpin` to answer. */
  pinnedIds: readonly string[];
  /**
   * The user pinned `pin.widget` over `pin.datePreset` (and `pin.customRange` when `custom`), under
   * `pin.filters` when it has them.
   */
  onPin: (pin: Omit<ObservabilityWidgetPin, 'pinned'>, app: McpAppRef) => void;
  /** The user unpinned the widget with this id. */
  onUnpin: (widgetId: string, app: McpAppRef) => void;
};

export type ObservabilityWidgetHostOptions = Omit<ObservabilityWidgetView, 'customRange'> & {
  /** The window drawn when `datePreset` is `custom`: the Metrics page's `customRange` as is, or ISO strings. */
  customRange?: { from?: Date | string; to?: Date | string };
  /** The `ui://` URI the observability widget app is registered under; other apps are left alone. */
  resourceUri: string;
  /** Lets the user pin widgets. Left out, the widgets show no pin button. */
  pins?: ObservabilityWidgetPins;
};

export type ObservabilityWidgetPinsOptions = ObservabilityWidgetPins & { resourceUri: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The app's pin update, checked by shape only: the widget itself is validated when it's drawn. */
function readPin(structuredContent: Record<string, unknown> | undefined): ObservabilityWidgetPin | undefined {
  const pin = structuredContent?.[OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY];
  if (!isRecord(pin) || typeof pin.pinned !== 'boolean' || typeof pin.datePreset !== 'string') return undefined;
  if (!isRecord(pin.widget) || typeof pin.widget.id !== 'string') return undefined;
  if (pin.filters !== undefined && !Array.isArray(pin.filters)) return undefined;
  const range = isRecord(pin.customRange) ? pin.customRange : undefined;
  const customRange: ObservabilityWidgetDateRange | undefined = range && {
    ...(typeof range.from === 'string' ? { from: range.from } : {}),
    ...(typeof range.to === 'string' ? { to: range.to } : {}),
  };
  return {
    pinned: pin.pinned,
    widget: { ...pin.widget, id: pin.widget.id },
    datePreset: pin.datePreset,
    ...(customRange ? { customRange } : {}),
    ...(pin.filters ? { filters: pin.filters } : {}),
  };
}

const toIso = (date: Date | string | undefined) => (date instanceof Date ? date.toISOString() : date);

/**
 * What the host passes down to the observability widget app: the host page's `datePreset` (with its
 * `customRange` when `custom`) and `filters`, drawn instead of the dashboard's own, and the `projectId` sent with every
 * `queryObservability` call. The app redraws when any of them changes.
 *
 * ```tsx
 * const host = useMemo(
 *   () =>
 *     observabilityWidgetHost({
 *       resourceUri: 'ui://mastra/observability-widget',
 *       datePreset,
 *       customRange,
 *       filters,
 *       projectId,
 *     }),
 *   [datePreset, customRange, filters, projectId],
 * );
 * <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>
 * ```
 *
 * Pass `pins` to let the user pin widgets too. A click shows on the button right away and holds
 * until the host's ids next change, so a host that turns a click down leaves it showing until then.
 */
export function observabilityWidgetHost({
  resourceUri,
  datePreset,
  customRange,
  filters,
  projectId,
  pins,
}: ObservabilityWidgetHostOptions): McpAppHostValue {
  const from = toIso(customRange?.from);
  const to = toIso(customRange?.to);
  // Always sent, even empty, so a field the host stops setting is cleared in the app too.
  const view: ObservabilityWidgetView = {
    ...(datePreset ? { datePreset } : {}),
    ...(datePreset === 'custom' && customRange
      ? { customRange: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }
      : {}),
    ...(filters ? { filters } : {}),
    ...(projectId ? { projectId } : {}),
  };
  return {
    hostContext: app =>
      app.resourceUri === resourceUri
        ? {
            [OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY]: view,
            ...(pins ? { [OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY]: pins.pinnedIds } : {}),
          }
        : undefined,
    onModelContext: pins
      ? (app, params) => {
          if (app.resourceUri !== resourceUri) return;
          const pin = readPin(params.structuredContent);
          if (!pin) return;
          if (pin.pinned) {
            const { pinned: _pinned, ...pinned } = pin;
            pins.onPin(pinned, app);
          } else pins.onUnpin(pin.widget.id, app);
        }
      : undefined,
  };
}

/** Lets the user pin observability widgets from the chat: `observabilityWidgetHost` with only `pins`. */
export function observabilityWidgetPins({ resourceUri, ...pins }: ObservabilityWidgetPinsOptions): McpAppHostValue {
  return observabilityWidgetHost({ resourceUri, pins });
}
