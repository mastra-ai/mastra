import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { storageWithoutMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
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

const completedAgentExperiment: DatasetExperiment = {
  ...experiments[0],
  datasetId: 'dataset-1',
  targetId: 'agent-1',
};
const failedOtherExperiment: DatasetExperiment = {
  ...experiments[1],
  datasetId: 'dataset-2',
  targetId: 'agent-2',
  status: 'failed',
};
const allExperiments = [completedAgentExperiment, failedOtherExperiment];

function setupHandlers() {
  const calls = { globalQueries: [] as URLSearchParams[] };

  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.globalQueries.push(query);
      const targetType = query.get('targetType');
      const targetId = query.get('targetId');
      const list = allExperiments.filter(
        exp => (!targetType || exp.targetType === targetType) && (!targetId || exp.targetId === targetId),
      );
      return HttpResponse.json(buildListExperimentsResponse(list));
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ params }) =>
      HttpResponse.json(buildListExperimentsResponse(allExperiments.filter(exp => exp.datasetId === params.datasetId))),
    ),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(
        buildListDatasetsResponse([
          buildDataset({ id: 'dataset-1', name: 'Dataset One' }),
          buildDataset({ id: 'dataset-2', name: 'Dataset Two' }),
        ]),
      ),
    ),
  );

  return calls;
}

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

const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });
const getLocation = () => screen.getByTestId('location').textContent;

/**
 * Builds a `<field> is <value>` filter through the typeahead input. Typed text lands on the
 * search field first, so the named field is one ArrowDown away.
 */
const pickFilter = async (field: string, value: string) => {
  getFilterInput().focus();
  typeFilter(field);
  await screen.findByRole('option', { name: field });
  pressFilterKey('ArrowDown');
  pressFilterKey('Enter');
  typeFilter(value);
  await screen.findByRole('option', { name: value });
  pressFilterKey('Enter');
};

describe('Experiments page filter bar', () => {
  describe('when no filter is set', () => {
    it('renders an empty filter bar in the action row', async () => {
      setupHandlers();
      renderPage();

      await screen.findByRole('group', { name: 'Experiments filters' });
      await screen.findByText('entity-extraction / model-a');
      expect(getChips()).toHaveLength(0);
    });
  });

  describe('when a Status chip is added', () => {
    it('only lists experiments with that status', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('entity-extraction / model-b');

      await pickFilter('Status', 'Failed');

      await screen.findByRole('group', { name: 'Status Failed' });
      await waitFor(() => expect(screen.queryByText('entity-extraction / model-a')).toBeNull());
      expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    });
  });

  describe('when free text is committed', () => {
    it('adds a search chip that narrows the list', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('entity-extraction / model-b');

      getFilterInput().focus();
      typeFilter('model-a');
      await screen.findByRole('option', { name: /contains "model-a"/ });
      pressFilterKey('Enter');

      await screen.findByRole('group', { name: 'Search model-a' });
      await waitFor(() => expect(screen.queryByText('entity-extraction / model-b')).toBeNull());
      expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    });
  });

  describe('when no experiment matches the filters', () => {
    it('says so instead of showing an empty table', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('entity-extraction / model-b');

      getFilterInput().focus();
      typeFilter('zzz-nomatch');
      await screen.findByRole('option', { name: /contains "zzz-nomatch"/ });
      pressFilterKey('Enter');

      expect(await screen.findByText('No experiments match your filters')).toBeDefined();
    });
  });

  describe('when a Dataset chip is added', () => {
    it('writes ?dataset= and lists that dataset only', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('entity-extraction / model-b');

      await pickFilter('Dataset', 'Dataset One');

      await waitFor(() => expect(getLocation()).toBe('/experiments?dataset=dataset-1'));
      await waitFor(() => expect(screen.queryByText('entity-extraction / model-b')).toBeNull());
    });
  });

  describe('when ?dataset= is in the URL', () => {
    it('shows it as a Dataset chip', async () => {
      setupHandlers();
      renderPage('/experiments?dataset=dataset-1');

      await screen.findByRole('group', { name: 'Dataset Dataset One' });
    });

    it('clears the param when the chip is removed', async () => {
      setupHandlers();
      renderPage('/experiments?dataset=dataset-1');

      const chip = await screen.findByRole('group', { name: 'Dataset Dataset One' });
      fireEvent.click(within(chip).getByRole('button', { name: 'Remove Dataset filter' }));

      await waitFor(() => expect(getLocation()).toBe('/experiments'));
    });
  });

  describe('when Target type and target chips are added', () => {
    it('forwards targetType and targetId to the server', async () => {
      const calls = setupHandlers();
      renderPage();
      await screen.findByText('entity-extraction / model-b');

      await pickFilter('Target type', 'Agent');
      await waitFor(() => expect(getLocation()).toBe('/experiments?targetType=agent'));

      await pickFilter('Agent', 'Support Agent');
      await waitFor(() => expect(getLocation()).toBe('/experiments?targetType=agent&targetId=agent-1'));

      await waitFor(() => expect(screen.queryByText('entity-extraction / model-b')).toBeNull());
      const lastQuery = calls.globalQueries.at(-1)!;
      expect(lastQuery.get('targetType')).toBe('agent');
      expect(lastQuery.get('targetId')).toBe('agent-1');
    });
  });

  describe('when ?targetType= and ?targetId= are in the URL', () => {
    it('drops the target id when the target type chip is removed', async () => {
      setupHandlers();
      renderPage('/experiments?targetType=agent&targetId=agent-1');

      const chip = await screen.findByRole('group', { name: 'Target type Agent' });
      fireEvent.click(within(chip).getByRole('button', { name: 'Remove Target type filter' }));

      await waitFor(() => expect(getLocation()).toBe('/experiments'));
    });
  });
});
