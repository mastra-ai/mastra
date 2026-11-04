import { DashboardRenderer, dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { DashboardRendererProps, OnDashboardDrilldown } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useState, useSyncExternalStore } from 'react';
import { defineMcpApp } from '../../runtime/define-mcp-app';
import { MastraServerProvider } from '../../runtime/mastra-server-provider';
import { useMcpApp } from '../../runtime/mcp-app-context';
import { createDashboardDataFetch } from './data-fetch';
import { drilldownContext, drilldownMessage, drilldownPrompt } from './drilldown';
import { dashboardRendererInputSchema } from './input';
import type { DashboardRendererInput } from './input';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY, DASHBOARD_WIDGET_PIN_NOTIFICATION } from './pin';
import type { DashboardWidgetPinNotificationParams } from './pin';
import './dashboard.css';

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

function Dashboard({ input }: { input: DashboardRendererInput }) {
  const app = useMcpApp();
  const [defaults] = useState(() => dashboardDefaults(input.definition));
  const [preset, setPreset] = useState<DatePreset>(defaults.preset ?? '24h');
  const [filterTokens, setFilterTokens] = useState(defaults.filterTokens);

  const capabilities = app.getHostCapabilities();
  // Drilldowns continue the conversation, so they only show on hosts that accept messages.
  // Hosts that take model context get the exact filters as data; the rest get them spelled out.
  const onDrilldown: OnDashboardDrilldown | undefined = capabilities?.message
    ? (page, scope) => {
        const send = async () => {
          let text = drilldownMessage(page, scope, preset);
          if (capabilities.updateModelContext) {
            await app.updateModelContext(drilldownContext(page, scope, preset));
            text = drilldownPrompt(page);
          }
          await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
        };
        // A host that disconnects mid-drilldown must not surface as an unhandled rejection.
        send().catch(error => console.error('[Mastra dashboard] Drilldown failed', error));
      }
    : undefined;

  // The host owns the pinned widgets: the app asks it to change, and shows what it sends back.
  const pinnedWidgets = useHostPinnedWidgets(app);
  const onPin: NonNullable<DashboardRendererProps['onPin']> = (widget, next) => {
    const params: DashboardWidgetPinNotificationParams = {
      widget,
      scope: input.scope,
      defaults: { datePreset: preset, filters: filterTokens },
      isPinned: next,
    };
    app
      .notification({ method: DASHBOARD_WIDGET_PIN_NOTIFICATION, params })
      .catch(error => console.error('[Mastra dashboard] Pin failed', error));
  };
  const pin = pinnedWidgets ? { onPin, isPinned: (widgetId: string) => pinnedWidgets.includes(widgetId) } : {};

  return (
    <MastraServerProvider createFetch={createDashboardDataFetch}>
      <MetricsProvider
        preset={preset}
        onPresetChange={setPreset}
        filterTokens={filterTokens}
        onFilterTokensChange={setFilterTokens}
      >
        <DashboardRenderer definition={input.definition} scope={input.scope} onDrilldown={onDrilldown} {...pin} />
      </MetricsProvider>
    </MastraServerProvider>
  );
}

export const app = defineMcpApp({
  name: 'Mastra dashboard',
  schema: dashboardRendererInputSchema,
  loadingTitle: 'Loading dashboard',
  errorTitle: "Couldn't show this dashboard",
  render: input => <Dashboard input={input} />,
});
