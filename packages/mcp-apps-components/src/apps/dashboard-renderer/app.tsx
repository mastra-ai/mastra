import { DashboardRenderer, dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { DashboardRendererProps, OnDashboardDrilldown } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import { useRef, useState } from 'react';
import { createMcpAppDataFetch } from '../../runtime/data-fetch';
import { defineMcpApp } from '../../runtime/define-mcp-app';
import { MastraServerProvider } from '../../runtime/mastra-server-provider';
import { useMcpApp } from '../../runtime/mcp-app-context';
import { dashboardContract } from './contract';
import { drilldownContext, drilldownMessage, drilldownPrompt } from './drilldown';
import { dashboardInputSchema } from './input';
import type { DashboardInput } from './input';
import { dashboardModelContext } from './model-context';
import type { DrilldownModelContext } from './model-context';
import { useDashboardPins } from './use-dashboard-pins';
import './dashboard.css';

function Dashboard({ input }: { input: DashboardInput }) {
  const app = useMcpApp();
  const [defaults] = useState(() => dashboardDefaults(input.definition));
  const [preset, setPreset] = useState<DatePreset>(defaults.preset ?? '24h');
  const [filterTokens, setFilterTokens] = useState(defaults.filterTokens);
  const pins = useDashboardPins(app, input, { datePreset: preset, filters: filterTokens });

  const capabilities = app.getHostCapabilities();
  // Each model context update replaces the last, so pins re-send the last drilldown and drilldowns the pins.
  const lastDrilldown = useRef<DrilldownModelContext | undefined>(undefined);
  const updateModelContext = async () => {
    const pinState = pins.report();
    try {
      await app.updateModelContext(dashboardModelContext({ pins: pinState, drilldown: lastDrilldown.current }));
    } catch (error) {
      if (pinState) pins.rejected(pinState.request);
      throw error;
    }
  };

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

  const pinState = pins.pin;
  const onPin: NonNullable<DashboardRendererProps['onPin']> = (widget, next) => {
    pinState?.request(widget.id, next);
    updateModelContext().catch(error => console.error('[Mastra dashboard] Pin failed', error));
  };
  const pin = pinState ? { onPin, isPinned: pinState.isPinned } : {};

  return (
    <MastraServerProvider
      createFetch={hostApp => createMcpAppDataFetch(hostApp, { ui: dashboardContract, projectId: input.projectId })}
    >
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
  name: dashboardContract.name,
  schema: dashboardInputSchema,
  loadingTitle: 'Loading dashboard',
  errorTitle: "Couldn't show this dashboard",
  render: input => <Dashboard input={input} />,
});
