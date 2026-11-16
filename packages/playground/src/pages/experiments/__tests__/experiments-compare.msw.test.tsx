import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
/** Oldest run, so it is listed after the `dataset-1` runs. */
const otherDataset: DatasetExperiment = {
  ...experiments[2],
  id: 'exp-c',
  datasetId: 'dataset-2',
  name: 'run c',
  createdAt: '2026-06-30T10:00:00.000Z',
};
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

function isSelectable(id: string) {
  const checkbox = screen.getByRole('checkbox', { name: `Select experiment ${id}` });
  return checkbox.getAttribute('aria-disabled') !== 'true' && !checkbox.hasAttribute('data-disabled');
}

/** Ids of the experiments whose checkbox can be clicked. */
function selectableExperiments() {
  return ['exp-a', 'exp-b', 'exp-c'].filter(isSelectable);
}

/** The Baseline/Contender badge in the row of the named experiment, if any. */
function selectionRoleOf(name: string) {
  const row = screen.getByText(name).closest('a')!;
  return within(row).queryByText(/^(Baseline|Contender \d+)$/)?.textContent ?? null;
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

    it('lets every experiment be selected', async () => {
      await renderLoadedPage();

      expect(selectableExperiments()).toEqual(['exp-a', 'exp-b', 'exp-c']);
    });

    it('shows no Baseline or Contender badge', async () => {
      await renderLoadedPage();

      expect(['run a', 'run b', 'run c'].map(selectionRoleOf)).toEqual([null, null, null]);
    });

    it('explains that the first pick sets the dataset to compare', async () => {
      await renderLoadedPage();

      expect(getLegend().textContent).toBe('Select an experiment to pick the dataset to compare');
    });
  });

  describe('when only one experiment is selected', () => {
    it('keeps Compare disabled and asks for a second one', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(getCompareButton().hasAttribute('disabled')).toBe(true);
      expect(await getCompareTooltip()).toBe('Select at least two experiments to compare');
    });

    it('disables the checkboxes of experiments from other datasets', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(selectableExperiments()).toEqual(['exp-a', 'exp-b']);
    });

    it('marks it as the Baseline', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(selectionRoleOf('run a')).toBe('Baseline');
      expect(selectionRoleOf('run b')).toBeNull();
    });

    it('names the dataset its comparable experiments share', async () => {
      await renderLoadedPage();
      select('exp-a');

      expect(getLegend().textContent).toBe('Comparable experiments share dataset Dataset One');
    });

    it('ignores a click on an experiment of another dataset', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-c');

      expect(isChecked('exp-c')).toBe(false);
      expect(getSelectionCount(1)).toBeDefined();
    });
  });

  describe('when the dataset of the selected experiment cannot be found', () => {
    beforeEach(() => {
      server.use(http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([]))));
    });

    it('gives the dataset id in the legend instead', async () => {
      await renderLoadedPage();
      select('exp-a');

      await waitFor(() => expect(getLegend().textContent).toBe('Comparable experiments share dataset dataset-1'));
    });
  });

  describe('when a second experiment is selected', () => {
    it('marks it as Contender 1', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      expect(selectionRoleOf('run a')).toBe('Baseline');
      expect(selectionRoleOf('run b')).toBe('Contender 1');
    });
  });

  describe('when the first selected experiment is deselected', () => {
    it('promotes the next selected experiment to Baseline', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b', 'exp-a');

      expect(selectionRoleOf('run a')).toBeNull();
      expect(selectionRoleOf('run b')).toBe('Baseline');
    });
  });

  describe('when every selected experiment is deselected', () => {
    it('lets experiments of any dataset be selected again', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-a');

      expect(selectableExperiments()).toEqual(['exp-a', 'exp-b', 'exp-c']);
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
    it('selects only the experiments sharing the dataset of the first listed one', async () => {
      await renderLoadedPage();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all experiments' }));

      expect(['exp-a', 'exp-b'].every(isChecked)).toBe(true);
      expect(isChecked('exp-c')).toBe(false);
      expect(getSelectionCount(2)).toBeDefined();
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
          HttpResponse.json(buildListExperimentsResponse([sameDatasetB, otherDataset, moreSameDataset[0]])),
        ),
      );
      await queryClient.invalidateQueries();
      await waitFor(() => expect(screen.queryByText('run a')).toBeNull());

      select('exp-d');

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
