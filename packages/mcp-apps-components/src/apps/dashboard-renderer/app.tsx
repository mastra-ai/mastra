import { DashboardRenderer } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { defineMcpApp } from '../../runtime/define-mcp-app';
import { MastraServerProvider } from '../../runtime/mastra-server-provider';
import { dashboardRendererInputSchema } from './input';
import type { DashboardRendererInput } from './input';

type FilterTokens = ComponentProps<typeof MetricsProvider>['filterTokens'];

function Dashboard({ input }: { input: DashboardRendererInput }) {
  const [preset, setPreset] = useState<DatePreset>(input.preset);
  const [filterTokens, setFilterTokens] = useState<FilterTokens>([]);

  return (
    <MastraServerProvider connection={input}>
      <MetricsProvider
        preset={preset}
        onPresetChange={setPreset}
        filterTokens={filterTokens}
        onFilterTokensChange={setFilterTokens}
      >
        <DashboardRenderer definition={input.definition} scope={input.scope} />
      </MetricsProvider>
    </MastraServerProvider>
  );
}

export const app = defineMcpApp({
  name: 'Mastra dashboard',
  schema: dashboardRendererInputSchema,
  loadingTitle: 'Loading dashboard',
  errorTitle: "Couldn't show this dashboard",
  render: input => <Dashboard key={input.baseUrl} input={input} />,
});
