import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import { MetricsCard, onCardHover } from '@mastra/playground-ui/components/MetricsCard';
import type { App } from '@modelcontextprotocol/ext-apps';
import { PinIcon, PinOffIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY, OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY } from './tool';
import type { ObservabilityDatePreset, ObservabilityWidgetDateRange, ObservabilityWidgetPin } from './tool';

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
 * The widget's pin button, as host actions for its card. The host owns what is pinned: a click is reported through model context
 * and shown right away, until the host sends its pinned ids back (or the update fails).
 */
export function usePin(
  app: App,
  widget: DashboardWidget,
  datePreset: ObservabilityDatePreset | 'custom',
  customRange: ObservabilityWidgetDateRange | undefined,
  filters: readonly unknown[] | undefined,
): ReactNode {
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
  // The host gets the widget as the opening tool returned it, not as the renderer parsed it.
  const onPin = (pinned: boolean) => {
    setRequested(pinned);
    const pin: ObservabilityWidgetPin = {
      pinned,
      widget,
      datePreset,
      ...(customRange ? { customRange } : {}),
      ...(filters?.length ? { filters: [...filters] } : {}),
    };
    app
      .updateModelContext({
        content: [{ type: 'text', text: `The user ${pinned ? 'pinned' : 'unpinned'} the "${name}" widget.` }],
        structuredContent: { [OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY]: pin },
      })
      .catch(() => setRequested(undefined));
  };
  const isPinned = requested ?? hostIds.includes(widget.id);
  // Unpinned, the button waits for the card's hover; pinned, it stays in view so the card reads as pinned.
  return (
    <MetricsCard.Action
      label={`${isPinned ? 'Unpin' : 'Pin'} ${name}`}
      onClick={() => onPin(!isPinned)}
      className={isPinned ? undefined : onCardHover}
    >
      {isPinned ? <PinOffIcon /> : <PinIcon />}
    </MetricsCard.Action>
  );
}
