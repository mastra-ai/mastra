/**
 * @vitest-environment jsdom
 */
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MetricsTab } from '../apps/observability-explorer/metrics-tab';
import { metricsArgsToFilters } from '../apps/observability-explorer/opened-filters';

/** The dashboard's data calls answer with nothing; this test is about what it opens on. */
const emptyFetch = async () => new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } });

it("opens on the opening tool's filters and says which ones it couldn't apply", async () => {
  const opening = metricsArgsToFilters({ entityName: 'support-agent', entityType: 'tool_call' });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MastraReactProvider baseUrl="https://mcp-app.mastra.invalid" customFetch={emptyFetch}>
        <TooltipProvider>
          <MetricsTab onDrilldown={() => {}} logs opening={opening} />
        </TooltipProvider>
      </MastraReactProvider>
    </QueryClientProvider>,
  );

  expect(await screen.findByText('support-agent')).toBeTruthy();
  expect(screen.getByText(/also filtered by entityType, which the dashboard can't apply/)).toBeTruthy();
});
