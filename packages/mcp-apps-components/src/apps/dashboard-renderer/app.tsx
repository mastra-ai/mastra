import { DashboardRenderer, dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { OnDashboardDrilldown } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import { useState } from 'react';
import { defineMcpApp } from '../../runtime/define-mcp-app';
import { MastraServerProvider } from '../../runtime/mastra-server-provider';
import { useMcpApp } from '../../runtime/mcp-app-context';
import { drilldownMessage } from './drilldown';
import { dashboardRendererInputSchema } from './input';
import type { DashboardRendererInput } from './input';

function Dashboard({ input }: { input: DashboardRendererInput }) {
  const app = useMcpApp();
  const [defaults] = useState(() => dashboardDefaults(input.definition));
  const [preset, setPreset] = useState<DatePreset>(defaults.preset ?? '24h');
  const [filterTokens, setFilterTokens] = useState(defaults.filterTokens);

  // Drilldowns continue the conversation, so they only show on hosts that accept messages.
  const onDrilldown: OnDashboardDrilldown | undefined = app.getHostCapabilities()?.message
    ? (page, scope) =>
        void app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: drilldownMessage(page, scope, preset) }],
        })
    : undefined;

  return (
    <MastraServerProvider>
      <MetricsProvider
        preset={preset}
        onPresetChange={setPreset}
        filterTokens={filterTokens}
        onFilterTokensChange={setFilterTokens}
      >
        <DashboardRenderer definition={input.definition} scope={input.scope} onDrilldown={onDrilldown} />
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
