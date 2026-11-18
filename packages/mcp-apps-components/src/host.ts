import {
  OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY,
} from './apps/observability-widget/tool';
import type {
  ObservabilityWidgetConfigure,
  ObservabilityWidgetDateRange,
  ObservabilityWidgetPin,
  ObservabilityWidgetView,
} from './apps/observability-widget/tool';

export {
  OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY,
  OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY,
} from './apps/observability-widget/tool';
export type {
  ObservabilityWidgetConfigure,
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
  /**
   * The user clicked the settings button of `configure.widget`, drawn over `configure.datePreset` (and
   * `configure.customRange` when `custom`) under `configure.filters` when it has them. Left out, the
   * widgets show no settings button.
   */
  onConfigure?: (configure: ObservabilityWidgetConfigure, app: McpAppRef) => void;
};

export type ObservabilityWidgetPinsOptions = ObservabilityWidgetPins & { resourceUri: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The widget the app sends with a pin or settings click, checked by shape only: the widget itself is validated when it's drawn. */
function readDrawnWidget(value: unknown): ObservabilityWidgetConfigure | undefined {
  if (!isRecord(value) || typeof value.datePreset !== 'string') return undefined;
  if (!isRecord(value.widget) || typeof value.widget.id !== 'string') return undefined;
  if (value.filters !== undefined && !Array.isArray(value.filters)) return undefined;
  const range = isRecord(value.customRange) ? value.customRange : undefined;
  const customRange: ObservabilityWidgetDateRange | undefined = range && {
    ...(typeof range.from === 'string' ? { from: range.from } : {}),
    ...(typeof range.to === 'string' ? { to: range.to } : {}),
  };
  return {
    widget: { ...value.widget, id: value.widget.id },
    datePreset: value.datePreset,
    ...(customRange ? { customRange } : {}),
    ...(value.filters ? { filters: value.filters } : {}),
  };
}

function readPin(structuredContent: Record<string, unknown> | undefined): ObservabilityWidgetPin | undefined {
  const pin = structuredContent?.[OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY];
  if (!isRecord(pin) || typeof pin.pinned !== 'boolean') return undefined;
  const drawn = readDrawnWidget(pin);
  return drawn && { pinned: pin.pinned, ...drawn };
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
 *
 * Pass `onConfigure` to show a settings button on each widget, e.g. to open the host's own dialog for it.
 */
export function observabilityWidgetHost({
  resourceUri,
  datePreset,
  customRange,
  filters,
  projectId,
  pins,
  onConfigure,
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
            ...(onConfigure ? { [OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY]: true } : {}),
          }
        : undefined,
    onModelContext:
      pins || onConfigure
        ? (app, params) => {
            if (app.resourceUri !== resourceUri) return;
            const configure =
              onConfigure && readDrawnWidget(params.structuredContent?.[OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY]);
            if (configure) onConfigure(configure, app);
            const pin = pins && readPin(params.structuredContent);
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
