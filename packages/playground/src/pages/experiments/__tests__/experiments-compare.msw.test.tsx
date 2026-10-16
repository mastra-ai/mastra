import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { storageWithoutMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
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
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
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

function getCompareButton() {
  return screen.getByRole('button', { name: /^compare$/i });
}

/** The disabled Compare button sits in a focusable wrapper that owns the tooltip. */
async function getCompareTooltip() {
  fireEvent.focus(getCompareButton().parentElement!);
  return (await screen.findByRole('tooltip')).textContent;
}

function getSelectionCount(count: number) {
  return screen.getByRole('button', { name: `${count} selected` });
}

function isChecked(id: string) {
  return screen.getByRole('checkbox', { name: `Select experiment ${id}` }).getAttribute('aria-checked') === 'true';
}

/** Names of the experiments whose row carries the comparable (info) tone. */
function highlightedExperiments() {
  return ['run a', 'run b', 'run c'].filter(
    name => screen.getByText(name).closest('a')?.getAttribute('data-variant') === 'info',
  );
}

function getLegend() {
  return screen.getByRole('note', { name: 'Comparable experiments' });
}

async function renderLoadedPage() {
  const result = renderPage();
  await screen.findByText('run a');
  return result;
}

describe('Experiments page — selection and compare', () => {
  describe('when the list loads', () => {
    it('shows a checkbox on every row plus a select-all checkbox', async () => {
      await renderLoadedPage();

      expect(screen.getByRole('checkbox', { name: 'Select all experiments' })).toBeDefined();
      expect(screen.getAllByRole('checkbox', { name: /^Select experiment / })).toHaveLength(3);
    });

    it('keeps rows as links to the experiment', async () => {
      await renderLoadedPage();

      expect(screen.getByText('run a').closest('a')?.getAttribute('href')).toContain('exp-a');
    });

    it('shows an empty selection count', async () => {
      await renderLoadedPage();

      expect(getSelectionCount(0).hasAttribute('disabled')).toBe(true);
    });

    it('disables Compare and explains that experiments must be selected', async () => {
      await renderLoadedPage();

      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
      expect(await getCompareTooltip()).toBe('Select at least two experiments to compare');
    });

    it('offers New experiment without a Reset button', async () => {
      await renderLoadedPage();

      expect(screen.getByRole('button', { name: /new experiment/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    });

    it('highlights no experiment', async () => {
      await renderLoadedPage();

      expect(highlightedExperiments()).toEqual([]);
    });

    it('explains above the list that a selection highlights the comparable experiments', async () => {
      await renderLoadedPage();

      expect(getLegend().textContent).toBe('Select an experiment to highlight comparable ones');
    });
  });

  describe('when only one experiment is selected', () => {
    it('keeps Compare disabled and asks for a second one', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
      expect(await getCompareTooltip()).toBe('Select at least two experiments to compare');
    });

    it('highlights every experiment of its dataset, itself included', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(highlightedExperiments()).toEqual(['run a', 'run b']);
    });

    it('explains the highlight above the list, giving the dataset id', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(getLegend().textContent).toBe('Comparable experiments share dataset dataset-1');
    });
  });

  describe('when the first selected experiment is deselected', () => {
    it('highlights the dataset of the next selected experiment instead', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-c', 'exp-a');

      expect(highlightedExperiments()).toEqual(['run c']);
      expect(getLegend().textContent).toBe('Comparable experiments share dataset dataset-2');
    });
  });

  describe('when the selection count is clicked', () => {
    it('clears the selection', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');
      fireEvent.click(getSelectionCount(2));

      expect(['exp-a', 'exp-b', 'exp-c'].some(isChecked)).toBe(false);
      expect(getSelectionCount(0)).toBeDefined();
    });

    it('disables Compare again', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');
      fireEvent.click(getSelectionCount(2));

      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
      expect(await getCompareTooltip()).toBe('Select at least two experiments to compare');
    });
  });

  describe('when the selected experiments belong to different datasets', () => {
    it('keeps Compare disabled and says why', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-c');

      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
      expect(await getCompareTooltip()).toMatch(/same dataset/i);
    });

    it('leaves the selected experiment of the other dataset without highlight', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-c');

      expect(highlightedExperiments()).toEqual(['run a', 'run b']);
    });
  });

  describe('when two experiments from the same dataset are selected', () => {
    it('navigates to /experiments/compare with baseline and contender', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      const compare = getCompareButton();
      expect(compare.hasAttribute('disabled')).toBe(false);
      fireEvent.click(compare);

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/experiments/compare?dataset=dataset-1&baseline=exp-a&contender=exp-b',
        ),
      );
    });
  });

  describe('when select-all is toggled with nothing selected', () => {
    it('selects every listed experiment', async () => {
      await renderLoadedPage();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all experiments' }));

      expect(['exp-a', 'exp-b', 'exp-c'].every(isChecked)).toBe(true);
      expect(getSelectionCount(3)).toBeDefined();
    });
  });

  describe('when select-all is toggled with some experiments selected', () => {
    it('clears the selection', async () => {
      await renderLoadedPage();
      select('exp-a');

      const selectAll = screen.getByRole('checkbox', { name: 'Select all experiments' });
      expect(selectAll.getAttribute('aria-checked')).toBe('mixed');
      fireEvent.click(selectAll);

      expect(['exp-a', 'exp-b', 'exp-c'].some(isChecked)).toBe(false);
    });
  });

  describe('when select-all is toggled with more experiments than compare slots', () => {
    beforeEach(listManySameDatasetExperiments);

    it('selects only the first ten', async () => {
      await renderLoadedPage();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all experiments' }));

      expect(getSelectionCount(10)).toBeDefined();
    });
  });

  describe('when a selected experiment disappears after a refetch', () => {
    it('drops it from the selection', async () => {
      const { queryClient } = await renderLoadedPage();
      select('exp-a', 'exp-b');
      expect(getSelectionCount(2)).toBeDefined();

      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, () =>
          HttpResponse.json(buildListExperimentsResponse([sameDatasetA, otherDataset])),
        ),
      );
      await queryClient.invalidateQueries();
      await waitFor(() => expect(screen.queryByText('run b')).toBeNull());

      expect(getSelectionCount(1)).toBeDefined();
      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
    });

    it('lets a new pick fill the freed slot', async () => {
      const { queryClient } = await renderLoadedPage();
      select('exp-a', 'exp-b');

      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, () =>
          HttpResponse.json(buildListExperimentsResponse([sameDatasetB, otherDataset])),
        ),
      );
      await queryClient.invalidateQueries();
      await waitFor(() => expect(screen.queryByText('run a')).toBeNull());

      select('exp-c');

      expect(getSelectionCount(2)).toBeDefined();
    });
  });

  describe('when three experiments from the same dataset are selected', () => {
    beforeEach(listManySameDatasetExperiments);

    it('counts them against the ten compare slots', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b', 'exp-d');

      expect(getSelectionCount(3)).toBeDefined();
    });

    it('compares the first pick as baseline against the others as contenders', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b', 'exp-d');
      fireEvent.click(getCompareButton());

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
      await renderLoadedPage();
      select('exp-a', 'exp-b', 'exp-d', 'exp-e', 'exp-f', 'exp-g', 'exp-h', 'exp-i', 'exp-j', 'exp-k', 'exp-l');

      expect(getSelectionCount(10)).toBeDefined();
      fireEvent.click(getCompareButton());

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/experiments/compare?dataset=dataset-1&baseline=exp-a' +
            ['b', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l'].map(suffix => `&contender=exp-${suffix}`).join(''),
        ),
      );
    });
  });
});
