import type { DatasetExperiment } from '@mastra/client-js';
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
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const datasetOne = buildDataset({ id: 'dataset-1', name: 'Dataset One' });
const datasetTwo = buildDataset({ id: 'dataset-2', name: 'Dataset Two' });

const sameDatasetA: DatasetExperiment = { ...experiments[0], id: 'exp-a', datasetId: 'dataset-1', name: 'run a' };
const sameDatasetB: DatasetExperiment = { ...experiments[1], id: 'exp-b', datasetId: 'dataset-1', name: 'run b' };
const otherDataset: DatasetExperiment = { ...experiments[2], id: 'exp-c', datasetId: 'dataset-2', name: 'run c' };
/** More runs of `dataset-1`, enough to fill and overflow the five compare slots. */
const moreSameDataset: DatasetExperiment[] = ['d', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map(suffix => ({
  ...experiments[3],
  id: `exp-${suffix}`,
  datasetId: 'dataset-1',
  name: `run ${suffix}`,
}));

function listManySameDatasetExperiments() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, () =>
      HttpResponse.json(buildListExperimentsResponse([sameDatasetA, sameDatasetB, otherDataset, ...moreSameDataset])),
    ),
  );
}

function select(...ids: string[]) {
  for (const id of ids) {
    fireEvent.click(screen.getByRole('checkbox', { name: `Select experiment ${id}` }));
  }
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () =>
      HttpResponse.json(buildListExperimentsResponse([sameDatasetA, sameDatasetB, otherDataset])),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ params }) =>
      HttpResponse.json(
        buildListExperimentsResponse(
          [sameDatasetA, sameDatasetB, otherDataset].filter(experiment => experiment.datasetId === params.datasetId),
        ),
      ),
    ),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(buildListDatasetsResponse([datasetOne, datasetTwo])),
    ),
  );
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage() {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments'] } },
  );
}

async function enterCompareMode() {
  await screen.findByText('run a');
  fireEvent.click(screen.getByRole('button', { name: /^compare$/i }));
}

describe('Experiments page — compare mode', () => {
  it('rows are links until compare mode is entered, then become selectable', async () => {
    renderPage();
    await screen.findByText('run a');

    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^compare$/i }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByText(/selected/)).toBeDefined();
  });

  it('navigates to /experiments/compare with baseline and contender from the same dataset', async () => {
    renderPage();
    await enterCompareMode();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-b' }));

    const compare = screen.getByRole('button', { name: /compare experiments/i });
    expect(compare.hasAttribute('disabled')).toBe(false);
    fireEvent.click(compare);

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        '/experiments/compare?dataset=dataset-1&baseline=exp-a&contender=exp-b',
      ),
    );
  });

  it('disables Compare when the selected experiments belong to different datasets', async () => {
    renderPage();
    await enterCompareMode();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-c' }));

    const compare = screen.getByRole('button', { name: /compare experiments/i });
    expect(compare.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/same dataset/i)).toBeDefined();
  });

  it('cancel leaves compare mode and clears the selection', async () => {
    renderPage();
    await enterCompareMode();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^compare$/i }));
    expect(screen.getAllByRole('checkbox').every(box => box.getAttribute('aria-checked') !== 'true')).toBe(true);
    expect(screen.getByRole('button', { name: /compare experiments/i }).hasAttribute('disabled')).toBe(true);
  });

  it('drops a selected experiment that disappears from the list after a refetch', async () => {
    const { queryClient } = renderPage();
    await enterCompareMode();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-b' }));
    expect(screen.getByText('2 / 10')).toBeDefined();

    server.use(
      http.get(`${TEST_BASE_URL}/api/experiments`, () =>
        HttpResponse.json(buildListExperimentsResponse([sameDatasetA, otherDataset])),
      ),
    );
    await queryClient.invalidateQueries();
    await waitFor(() => expect(screen.queryByText('run b')).toBeNull());

    expect(screen.getByText('1 / 10')).toBeDefined();
    expect(screen.getByRole('button', { name: /compare experiments/i }).hasAttribute('disabled')).toBe(true);
  });

  it('lets a new pick fill the slot freed by a disappeared first selection', async () => {
    const { queryClient } = renderPage();
    await enterCompareMode();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-b' }));

    server.use(
      http.get(`${TEST_BASE_URL}/api/experiments`, () =>
        HttpResponse.json(buildListExperimentsResponse([sameDatasetB, otherDataset])),
      ),
    );
    await queryClient.invalidateQueries();
    await waitFor(() => expect(screen.queryByText('run a')).toBeNull());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select experiment exp-c' }));

    expect(screen.getByText('2 / 10')).toBeDefined();
  });

  describe('when three experiments from the same dataset are selected', () => {
    beforeEach(listManySameDatasetExperiments);

    it('counts them against the ten compare slots', async () => {
      renderPage();
      await enterCompareMode();
      select('exp-a', 'exp-b', 'exp-d');

      expect(screen.getByText('3 / 10')).toBeDefined();
    });

    it('compares the first pick as baseline against the others as contenders', async () => {
      renderPage();
      await enterCompareMode();
      select('exp-a', 'exp-b', 'exp-d');
      fireEvent.click(screen.getByRole('button', { name: /compare experiments/i }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/experiments/compare?dataset=dataset-1&baseline=exp-a&contender=exp-b&contender=exp-d',
        ),
      );
    });
  });

  describe('when ten experiments are selected and an eleventh is picked', () => {
    beforeEach(listManySameDatasetExperiments);

    it('replaces the most recent pick and keeps the baseline', async () => {
      renderPage();
      await enterCompareMode();
      select('exp-a', 'exp-b', 'exp-d', 'exp-e', 'exp-f', 'exp-g', 'exp-h', 'exp-i', 'exp-j', 'exp-k', 'exp-l');

      expect(screen.getByText('10 / 10')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /compare experiments/i }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/experiments/compare?dataset=dataset-1&baseline=exp-a' +
            ['b', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l'].map(suffix => `&contender=exp-${suffix}`).join(''),
        ),
      );
    });
  });

  describe('when only one experiment is selected', () => {
    it('disables Compare', async () => {
      renderPage();
      await enterCompareMode();
      select('exp-a');

      expect(screen.getByRole('button', { name: /compare experiments/i }).hasAttribute('disabled')).toBe(true);
    });
  });
});
