import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  agents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const agentExperiment = { ...experiments[0], targetId: 'agent-1' };
const workflowExperiment = { ...experiments[1], targetType: 'workflow' as const, targetId: 'wf-1' };

function setupHandlers() {
  const calls = { globalQueries: [] as URLSearchParams[] };

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.globalQueries.push(query);
      const targetType = query.get('targetType');
      const targetId = query.get('targetId');
      const list = [agentExperiment, workflowExperiment].filter(
        exp => (!targetType || exp.targetType === targetType) && (!targetId || exp.targetId === targetId),
      );
      return HttpResponse.json(buildListExperimentsResponse(list));
    }),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(buildListDatasetsResponse([buildDataset({ id: 'dataset-1', name: 'Dataset One' })])),
    ),
  );

  return calls;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry: string) {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );
}

describe('Experiments page — target filter from URL', () => {
  it('forwards ?targetType= and ?targetId= to the server and shows the scoped list', async () => {
    const calls = setupHandlers();
    renderPage('/experiments?targetType=agent&targetId=agent-1');

    expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-b')).toBeNull();

    const lastQuery = calls.globalQueries.at(-1)!;
    expect(lastQuery.get('targetType')).toBe('agent');
    expect(lastQuery.get('targetId')).toBe('agent-1');
  });

  it('sends only targetType when no target id is given', async () => {
    const calls = setupHandlers();
    renderPage('/experiments?targetType=workflow');

    expect(await screen.findByText('entity-extraction / model-b')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-a')).toBeNull();

    const lastQuery = calls.globalQueries.at(-1)!;
    expect(lastQuery.get('targetType')).toBe('workflow');
    expect(lastQuery.has('targetId')).toBe(false);
  });

  it('ignores an unknown target type', async () => {
    const calls = setupHandlers();
    renderPage('/experiments?targetType=bogus&targetId=agent-1');

    expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    expect(calls.globalQueries.at(-1)!.has('targetType')).toBe(false);
  });

  it('keeps the filter toolbar when the target has no experiments', async () => {
    setupHandlers();
    renderPage('/experiments?targetType=agent&targetId=nobody');

    expect(await screen.findByText('Target')).toBeDefined();
    expect(screen.getByRole('button', { name: /reset/i })).toBeDefined();
    expect(screen.queryByText('No Experiments yet')).toBeNull();
  });

  it('clears the target params when filters are reset', async () => {
    setupHandlers();
    renderPage('/experiments?dataset=dataset-1&targetType=agent&targetId=agent-1');

    fireEvent.click(await screen.findByRole('button', { name: /reset/i }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/experiments'));
  });
});
