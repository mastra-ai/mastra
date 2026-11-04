import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DashboardRendererInput } from './input';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY } from './pin';
import type { DashboardPinnedWidget } from './pin';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * The ids of the widgets the host has pinned, from its context; `undefined` when it can't pin.
 * The snapshot is the context's own array, so it only changes when the host sends a new one.
 */
function useHostPinnedWidgets(app: App): readonly string[] | undefined {
  return useSyncExternalStore(
    onChange => {
      app.addEventListener('hostcontextchanged', onChange);
      return () => app.removeEventListener('hostcontextchanged', onChange);
    },
    () => {
      const pinned = app.getHostContext()?.[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
      return isStringArray(pinned) ? pinned : undefined;
    },
  );
}

/**
 * The dashboard's pin state. The host owns the pinned widgets: the app reports what the user wants
 * pinned through model context, and shows what the host sends back in host context.
 *
 * `pageDefaults` are the range and filters on now, recorded for each widget the user pins.
 */
export function useDashboardPins(
  app: App,
  input: DashboardRendererInput,
  pageDefaults: DashboardPinnedWidget['defaults'],
) {
  const hostPinned = useHostPinnedWidgets(app);
  const canPin = hostPinned !== undefined && Boolean(app.getHostCapabilities()?.updateModelContext?.structuredContent);

  // The ids the user asked for since the host last sent its own, so a click before the host
  // answers the previous one builds on it instead of on stale ids.
  const requested = useRef<readonly string[] | undefined>(undefined);
  // The range and filters on when each widget was pinned in this session.
  const pinDefaults = useRef(new Map<string, DashboardPinnedWidget['defaults']>());

  useEffect(() => {
    const onChange = (params: Record<string, unknown>) => {
      if (DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in params) requested.current = undefined;
    };
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);

  if (!canPin) return { pinned: () => undefined, pin: undefined };

  const pinnedIds = () => requested.current ?? hostPinned;

  return {
    /** Every widget the user wants pinned, for the model context. */
    pinned: (): DashboardPinnedWidget[] => {
      const widgets = input.definition.rows.flatMap(row => row.widgets);
      return pinnedIds().flatMap(id => {
        const widget = widgets.find(candidate => candidate.id === id);
        if (!widget) return [];
        return [{ widget, scope: input.scope, defaults: pinDefaults.current.get(id) ?? pageDefaults }];
      });
    },
    pin: {
      isPinned: (widgetId: string) => hostPinned.includes(widgetId),
      /** Records the user's click; send the model context after it. */
      request: (widgetId: string, next: boolean) => {
        const ids = pinnedIds().filter(id => id !== widgetId);
        if (next) {
          ids.push(widgetId);
          pinDefaults.current.set(widgetId, pageDefaults);
        } else {
          pinDefaults.current.delete(widgetId);
        }
        requested.current = ids;
      },
    },
  };
}
