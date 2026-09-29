import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
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

let listRequests: URL[] = [];

beforeEach(() => {
  listRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      listRequests.push(new URL(request.url));
      return HttpResponse.json(buildListExperimentsResponse(experiments));
    }),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(buildListDatasetsResponse([buildDataset({ id: 'dataset-1', name: 'Dataset One' })])),
    ),
  );
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry = '/experiments') {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );
}

const firstExperimentName = experiments[0].name ?? experiments[0].id;

describe('Experiments page — sorting', () => {
  it('does not ask the server for a sort by default', async () => {
    renderPage();
    await screen.findByText(firstExperimentName);

    expect(listRequests[0].searchParams.get('orderBy[field]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Date, not sorted, sort ascending' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Status, not sorted, sort ascending' })).not.toBeNull();
  });

  it('asks the server for oldest-first and writes it to the URL', async () => {
    renderPage();
    await screen.findByText(firstExperimentName);

    fireEvent.click(screen.getByRole('button', { name: 'Date, not sorted, sort ascending' }));

    await waitFor(() => expect(listRequests.at(-1)?.searchParams.get('orderBy[field]')).toBe('createdAt'));
    expect(listRequests.at(-1)?.searchParams.get('orderBy[direction]')).toBe('ASC');
    expect(screen.getByTestId('location').textContent).toBe('/experiments?sort=createdAt&dir=asc');
  });

  it('restores the sort from the URL', async () => {
    renderPage('/experiments?sort=status&dir=desc');
    await screen.findByText(firstExperimentName);

    expect(listRequests[0].searchParams.get('orderBy[field]')).toBe('status');
    expect(listRequests[0].searchParams.get('orderBy[direction]')).toBe('DESC');
    expect(screen.getByRole('button', { name: 'Status, sorted descending, sort ascending' })).not.toBeNull();
  });
});
