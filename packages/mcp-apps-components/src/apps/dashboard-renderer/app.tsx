import { DashboardRenderer, dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { DashboardRendererProps, OnDashboardDrilldown } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { defineMcpApp } from '../../runtime/define-mcp-app';
import { MastraServerProvider } from '../../runtime/mastra-server-provider';
import { useMcpApp } from '../../runtime/mcp-app-context';
import { drilldownContext, drilldownMessage, drilldownPrompt } from './drilldown';
import { dashboardRendererInputSchema } from './input';
import type { DashboardRendererInput } from './input';
import { dashboardModelContext } from './model-context';
import type { DrilldownModelContext } from './model-context';
import { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY } from './pin';
import type { DashboardPinnedWidget } from './pin';
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
  const pageDefaults: DashboardPinnedWidget['defaults'] = { datePreset: preset, filters: filterTokens };

  const capabilities = app.getHostCapabilities();
  // The host owns the pinned widgets: the app reports what the user wants pinned through model
  // context, and shows what the host sends back in host context.
  const hostPinned = useHostPinnedWidgets(app);
  const canPin = hostPinned !== undefined && Boolean(capabilities?.updateModelContext?.structuredContent);

  // The ids the user asked for since the host last sent its own, so a click before the host
  // answers the previous one builds on it instead of on stale ids.
  const requestedPins = useRef<readonly string[] | undefined>(undefined);
  // The range and filters on when each widget was pinned in this session.
  const pinDefaults = useRef(new Map<string, DashboardPinnedWidget['defaults']>());
  // Each model context update replaces the last, so pins re-send the last drilldown and drilldowns the pins.
  const lastDrilldown = useRef<DrilldownModelContext | undefined>(undefined);

  useEffect(() => {
    const onChange = (params: Record<string, unknown>) => {
      if (DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in params) requestedPins.current = undefined;
    };
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);

  const pinnedIds = () => requestedPins.current ?? hostPinned ?? [];
  const pinnedEntries = (ids: readonly string[]): DashboardPinnedWidget[] => {
    const widgets = input.definition.rows.flatMap(row => row.widgets);
    return ids.flatMap(id => {
      const widget = widgets.find(candidate => candidate.id === id);
      if (!widget) return [];
      return [{ widget, scope: input.scope, defaults: pinDefaults.current.get(id) ?? pageDefaults }];
    });
  };
  const updateModelContext = () =>
    app.updateModelContext(
      dashboardModelContext({
        pinned: canPin ? pinnedEntries(pinnedIds()) : undefined,
        drilldown: lastDrilldown.current,
      }),
    );

  // Drilldowns continue the conversation, so they only show on hosts that accept messages.
  // Hosts that take model context get the exact filters as data; the rest get them spelled out.
  const onDrilldown: OnDashboardDrilldown | undefined = capabilities?.message
    ? (page, scope) => {
        const send = async () => {
          let text = drilldownMessage(page, scope, preset);
          if (capabilities.updateModelContext) {
            lastDrilldown.current = drilldownContext(page, scope, preset);
            await updateModelContext();
            text = drilldownPrompt(page);
          }
          await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
        };
        // A host that disconnects mid-drilldown must not surface as an unhandled rejection.
        send().catch(error => console.error('[Mastra dashboard] Drilldown failed', error));
      }
    : undefined;

  const onPin: NonNullable<DashboardRendererProps['onPin']> = (widget, next) => {
    const ids = pinnedIds().filter(id => id !== widget.id);
    if (next) {
      ids.push(widget.id);
      pinDefaults.current.set(widget.id, pageDefaults);
    } else {
      pinDefaults.current.delete(widget.id);
    }
    requestedPins.current = ids;
    updateModelContext().catch(error => console.error('[Mastra dashboard] Pin failed', error));
  };
  const pin = canPin && hostPinned ? { onPin, isPinned: (widgetId: string) => hostPinned.includes(widgetId) } : {};

  return (
    <MastraServerProvider>
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
