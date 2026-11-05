import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import type { WidgetPin } from '@mastra/playground-ui/domains/dashboards';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ObservabilityWidgetPreset } from './opened';
import { OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY, OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY } from './tool';
import type { ObservabilityWidgetPin } from './tool';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** The host's pinned widget ids; `undefined` when it doesn't send them. Re-renders on change. */
function useHostPinnedIds(app: App): readonly string[] | undefined {
  return useSyncExternalStore(
    onChange => {
      app.addEventListener('hostcontextchanged', onChange);
      return () => app.removeEventListener('hostcontextchanged', onChange);
    },
    () => {
      const ids = app.getHostContext()?.[OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY];
      return isStringArray(ids) ? ids : undefined;
    },
  );
}

/**
 * The widget's pin button. The host owns what is pinned: a click is reported through model context
 * and shown right away, until the host sends its pinned ids back (or the update fails).
 */
export function usePin(
  app: App,
  widget: DashboardWidget,
  datePreset: ObservabilityWidgetPreset,
): WidgetPin | undefined {
  const hostIds = useHostPinnedIds(app);
  const [requested, setRequested] = useState<boolean>();

  useEffect(() => {
    const onChange = (params: Record<string, unknown>) => {
      if (OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY in params) setRequested(undefined);
    };
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);

  const canPin = hostIds !== undefined && Boolean(app.getHostCapabilities()?.updateModelContext?.structuredContent);
  if (!canPin) return undefined;

  const name = typeof widget.title === 'string' ? widget.title : widget.id;
  return {
    isPinned: requested ?? hostIds.includes(widget.id),
    name,
    onPin: pinned => {
      setRequested(pinned);
      const pin: ObservabilityWidgetPin = { pinned, widget, datePreset };
      app
        .updateModelContext({
          content: [{ type: 'text', text: `The user ${pinned ? 'pinned' : 'unpinned'} the "${name}" widget.` }],
          structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: pin },
        })
        .catch(() => setRequested(undefined));
    },
  };
}
