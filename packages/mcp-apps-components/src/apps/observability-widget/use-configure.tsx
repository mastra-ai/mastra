import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import { MetricsCard } from '@mastra/playground-ui/components/MetricsCard';
import type { App } from '@modelcontextprotocol/ext-apps';
import { SettingsIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY, OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY } from './tool';
import type { ObservabilityDatePreset, ObservabilityWidgetConfigure, ObservabilityWidgetDateRange } from './tool';

/** Whether the host says it can configure a widget. Re-renders on change. */
function useHostConfigurable(app: App): boolean {
  return useSyncExternalStore(
    onChange => {
      app.addEventListener('hostcontextchanged', onChange);
      return () => app.removeEventListener('hostcontextchanged', onChange);
    },
    () => app.getHostContext()?.[OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY] === true,
  );
}

/**
 * The widget's settings button, as a host action for its card. A click hands the widget, over the
 * window and filters it is drawn with, to the host through model context; the host shows its own settings.
 */
export function useConfigure(
  app: App,
  widget: DashboardWidget,
  datePreset: ObservabilityDatePreset | 'custom',
  customRange: ObservabilityWidgetDateRange | undefined,
  filters: readonly unknown[] | undefined,
): ReactNode {
  const configurable = useHostConfigurable(app);
  if (!configurable || !app.getHostCapabilities()?.updateModelContext?.structuredContent) return undefined;

  const name = typeof widget.title === 'string' ? widget.title : widget.id;
  const onConfigure = () => {
    const configure: ObservabilityWidgetConfigure = {
      widget,
      datePreset,
      ...(customRange ? { customRange } : {}),
      ...(filters?.length ? { filters: [...filters] } : {}),
    };
    void app
      .updateModelContext({
        content: [{ type: 'text', text: `The user opened the settings of the "${name}" widget.` }],
        structuredContent: { [OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY]: configure },
      })
      .catch(() => {});
  };
  return (
    <MetricsCard.Action
      label={`Configure ${name}`}
      onClick={onConfigure}
      className="hidden group-focus-within/metrics-card:inline-flex group-hover/metrics-card:inline-flex"
    >
      <SettingsIcon />
    </MetricsCard.Action>
  );
}
