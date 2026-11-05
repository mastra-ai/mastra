import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DashboardRendererInput } from './input';
import type { PinsModelContext } from './model-context';
import { DASHBOARD_PIN_REQUEST_CONTEXT_KEY, DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY } from './pin';
import type { DashboardPinnedWidget } from './pin';

type PinDefaults = NonNullable<DashboardPinnedWidget['defaults']>;

/** A click the host hasn't answered yet; `request` is the update that first carried it. */
type PendingClick = { pin: true; defaults: PinDefaults; request?: number } | { pin: false; request?: number };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** The ids of the widgets the host has pinned, from its context; `undefined` when it can't pin. */
function hostPinnedIds(app: App): string[] | undefined {
  const pinned = app.getHostContext()?.[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
  return isStringArray(pinned) ? pinned : undefined;
}

/**
 * `hostPinnedIds`, re-rendering when the host sends new ids. The snapshot is the context's own
 * array, so it only changes when the host sends a new one.
 */
function useHostPinnedWidgets(app: App): readonly string[] | undefined {
  return useSyncExternalStore(
    onChange => {
      app.addEventListener('hostcontextchanged', onChange);
      return () => app.removeEventListener('hostcontextchanged', onChange);
    },
    () => hostPinnedIds(app),
  );
}

/**
 * The dashboard's pin state. The host owns the pinned widgets: the app reports what the user wants
 * pinned through model context, and shows what the host sends back in host context.
 *
 * Clicks the host hasn't answered yet are applied on top of its latest ids, so quick clicks build
 * on each other. Each is dropped once the host answers its update, already holds what it asked
 * for, or its update fails.
 *
 * `pageDefaults` are the range and filters on now, recorded for each widget the user pins.
 */
export function useDashboardPins(app: App, input: DashboardRendererInput, pageDefaults: PinDefaults) {
  const hostPinned = useHostPinnedWidgets(app);
  const canPin = hostPinned !== undefined && Boolean(app.getHostCapabilities()?.updateModelContext?.structuredContent);

  // By widget id, in click order: the user's last click on a widget replaces the earlier ones.
  const pending = useRef(new Map<string, PendingClick>());
  // Start above the last answer the host holds, which can come from an earlier instance of this app.
  const [firstRequest] = useState(() => {
    const answered = app.getHostContext()?.[DASHBOARD_PIN_REQUEST_CONTEXT_KEY];
    return typeof answered === 'number' ? answered : 0;
  });
  const lastRequest = useRef(firstRequest);

  useEffect(() => {
    // The app merges the change into its host context before telling listeners.
    const onChange = (params: Record<string, unknown>) => {
      const answered = params[DASHBOARD_PIN_REQUEST_CONTEXT_KEY];
      const ids = hostPinnedIds(app);
      for (const [id, click] of pending.current) {
        const isAnswered = typeof answered === 'number' && click.request !== undefined && click.request <= answered;
        const isReflected = ids !== undefined && ids.includes(id) === click.pin;
        if (isAnswered || isReflected) pending.current.delete(id);
      }
    };
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);

  if (!canPin) return { pin: undefined, report: () => undefined, rejected: (_request: number) => {} };

  const pinned = (): DashboardPinnedWidget[] => {
    const clicks = pending.current;
    const ids = (hostPinnedIds(app) ?? []).filter(id => clicks.get(id)?.pin !== false);
    for (const [id, click] of clicks) if (click.pin && !ids.includes(id)) ids.push(id);

    const widgets = input.definition.rows.flatMap(row => row.widgets);
    return ids.flatMap(id => {
      const widget = widgets.find(candidate => candidate.id === id);
      if (!widget) return [];
      const click = clicks.get(id);
      // Only widgets pinned here carry defaults; the host keeps its own for the rest.
      return [{ widget, scope: input.scope, ...(click?.pin && { defaults: click.defaults }) }];
    });
  };

  return {
    pin: {
      isPinned: (widgetId: string) => hostPinned.includes(widgetId),
      /** Records the user's click; send the model context after it. */
      request: (widgetId: string, next: boolean) => {
        pending.current.delete(widgetId);
        pending.current.set(widgetId, next ? { pin: true, defaults: pageDefaults } : { pin: false });
      },
    },
    /** The pin state for the next model context update, numbered so the host can answer it. */
    report: (): PinsModelContext => {
      const request = ++lastRequest.current;
      for (const click of pending.current.values()) click.request ??= request;
      return { request, pinned: pinned() };
    },
    /** Drops the clicks a failed update carried; the host never saw them. */
    rejected: (request: number) => {
      for (const [id, click] of pending.current) if (click.request === request) pending.current.delete(id);
    },
  };
}
