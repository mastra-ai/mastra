import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import DatasetsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { buildListExperimentsResponse } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { agents } from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const agentDataset = buildDataset({
  id: 'ds-agent',
  name: 'Agent dataset',
  targetType: 'agent',
  targetIds: ['agent-1'],
});
const otherDataset = buildDataset({
  id: 'ds-other',
  name: 'Other dataset',
  targetType: 'agent',
  targetIds: ['agent-2'],
});

function setupHandlers() {
  const calls = { datasetQueries: [] as URLSearchParams[] };

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/datasets`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.datasetQueries.push(query);
      const targetType = query.get('targetType');
      const targetIds = query.getAll('targetIds');
      const list = [agentDataset, otherDataset].filter(
        ds =>
          (!targetType || ds.targetType === targetType) &&
          (targetIds.length === 0 || targetIds.some(id => ds.targetIds?.includes(id))),
      );
      return HttpResponse.json(buildListDatasetsResponse(list));
    }),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
  );

  return calls;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const renderPage = (initialEntry: string) =>
  renderWithProviders(
    <TooltipProvider>
      <TestLinkProvider>
        <Routes>
          <Route path="/datasets" element={<DatasetsPage />} />
        </Routes>
        <LocationProbe />
      </TestLinkProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

describe('Datasets page — target filter from URL', () => {
  it('forwards ?targetType= and ?targetId= to the server as targetType/targetIds', async () => {
    const calls = setupHandlers();
    renderPage('/datasets?targetType=agent&targetId=agent-1');

    expect(await screen.findByText('Agent dataset')).toBeDefined();
    expect(screen.queryByText('Other dataset')).toBeNull();

    const lastQuery = calls.datasetQueries.at(-1)!;
    expect(lastQuery.get('targetType')).toBe('agent');
    expect(lastQuery.getAll('targetIds')).toEqual(['agent-1']);
  });

  it('keeps the toolbar when the target has no datasets', async () => {
    setupHandlers();
    renderPage('/datasets?targetType=agent&targetId=nobody');

    expect(await screen.findByRole('button', { name: /reset/i })).toBeDefined();
    expect(screen.queryByText('Agent dataset')).toBeNull();
  });

  it('clears the target params when filters are reset', async () => {
    setupHandlers();
    renderPage('/datasets?targetType=agent&targetId=agent-1');

    fireEvent.click(await screen.findByRole('button', { name: /reset/i }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/datasets'));
    expect(await screen.findByText('Other dataset')).toBeDefined();
  });
});
