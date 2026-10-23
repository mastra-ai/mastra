import type { CreateDatasetParams } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DatasetsPage from '..';
import { emptyScorers } from './fixtures/query-loading';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

let listRequests: URL[] = [];

const useDatasets = (datasets = [buildDataset()]) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, ({ request }) => {
      listRequests.push(new URL(request.url));
      return HttpResponse.json(buildListDatasetsResponse(datasets));
    }),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
  );
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const renderPage = (initialEntry = '/datasets') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <LocationProbe />
        <Routes>
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/datasets/:datasetId" element={<div>Dataset page</div>} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

beforeEach(() => {
  listRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    // The create dialog's schema section lists workflows to import a schema from.
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
  );
});

describe('Datasets page', () => {
  describe('when datasets are sorted from a column', () => {
    beforeEach(() => useDatasets([buildDataset({ id: 'ds-1', name: 'Alpha' })]));

    it('does not ask the server for a sort by default', async () => {
      renderPage();

      await screen.findByText('Alpha');

      expect(listRequests[0].searchParams.get('orderBy[field]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Last Updated, not sorted, sort ascending' })).not.toBeNull();
    });

    it('asks the server for name ascending and writes it to the URL', async () => {
      renderPage();

      await screen.findByText('Alpha');
      fireEvent.click(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' }));

      await waitFor(() => expect(listRequests.at(-1)?.searchParams.get('orderBy[field]')).toBe('name'));
      expect(listRequests.at(-1)?.searchParams.get('orderBy[direction]')).toBe('ASC');
      expect(screen.getByTestId('location').textContent).toBe('/datasets?sort=name&dir=asc');
    });

    it('restores the sort from the URL', async () => {
      renderPage('/datasets?sort=updatedAt&dir=desc');

      await screen.findByText('Alpha');

      expect(listRequests[0].searchParams.get('orderBy[field]')).toBe('updatedAt');
      expect(listRequests[0].searchParams.get('orderBy[direction]')).toBe('DESC');
      expect(screen.getByRole('button', { name: 'Last Updated, sorted descending, sort ascending' })).not.toBeNull();
    });
  });

  describe('when datasets exist', () => {
    beforeEach(() => useDatasets());

    it('opens the create dialog from the New dataset header button', async () => {
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'New dataset' }));

      expect(await screen.findByRole('dialog', { name: 'Create new dataset' })).not.toBeNull();
    });

    it('opens the create dialog when pressing C', async () => {
      renderPage();

      await screen.findByRole('button', { name: 'New dataset' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByRole('dialog', { name: 'Create new dataset' })).not.toBeNull();
    });
  });

  describe('when a dataset is created from the dialog', () => {
    beforeEach(() => {
      useDatasets();
      server.use(
        http.post<never, CreateDatasetParams>(`${TEST_BASE_URL}/api/datasets`, () =>
          HttpResponse.json(buildDataset({ id: 'created-dataset' })),
        ),
      );
    });

    it('navigates to the new dataset', async () => {
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'New dataset' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Create dataset' }));

      expect(await screen.findByText('Dataset page')).not.toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/datasets/created-dataset');
    });
  });

  describe('when there are no datasets', () => {
    beforeEach(() => useDatasets([]));

    it('shows only the empty-state New dataset button', async () => {
      renderPage();

      await screen.findByText('No Datasets yet');
      expect(screen.getAllByRole('button', { name: 'New dataset' })).toHaveLength(1);
    });

    it('opens the create dialog from the empty-state New dataset button', async () => {
      renderPage();

      await screen.findByText('No Datasets yet');
      fireEvent.click(screen.getByRole('button', { name: 'New dataset' }));

      expect(await screen.findByRole('dialog', { name: 'Create new dataset' })).not.toBeNull();
    });
  });
});

describe('Datasets page query loading', () => {
  describe('when datasets are still loading', () => {
    it('starts the experiment request before the dataset response arrives', async () => {
      useDatasets();
      const experimentsRequested = vi.fn();
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets`, async () => {
          await held;
          return HttpResponse.json(buildListDatasetsResponse());
        }),
        http.get(`${TEST_BASE_URL}/api/experiments`, () => {
          experimentsRequested();
          return HttpResponse.json(buildListExperimentsResponse(experiments));
        }),
      );
      try {
        renderPage();
        await waitFor(() => expect(experimentsRequested).toHaveBeenCalledTimes(1));
      } finally {
        release();
      }
    });
  });

  describe('when experiment summaries are still loading', () => {
    it('shows the datasets before experiment summaries resolve', async () => {
      useDatasets([buildDataset({ id: 'ds-1', name: 'Alpha' })]);
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, async () => {
          await held;
          return HttpResponse.json(buildListExperimentsResponse([]));
        }),
      );
      try {
        renderPage();
        expect(await screen.findByText('Alpha')).not.toBeNull();
      } finally {
        release();
      }
    });

    it('replaces a dataset-specific loading label with its summary when experiments resolve', async () => {
      useDatasets([buildDataset({ name: 'Alpha' })]);
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, async () => {
          await held;
          return HttpResponse.json(buildListExperimentsResponse(experiments));
        }),
      );
      try {
        renderPage();
        expect(await screen.findByLabelText('Loading experiment summary for Alpha')).not.toBeNull();
        release();
        expect(await screen.findByRole('link', { name: '4 (100%)' })).not.toBeNull();
        expect(screen.queryByLabelText('Loading experiment summary for Alpha')).toBeNull();
      } finally {
        release();
      }
    });

    it('waits for experiment data when the user selects an experiment-dependent filter', async () => {
      useDatasets([buildDataset({ name: 'Alpha' })]);
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, async () => {
          await held;
          return HttpResponse.json(buildListExperimentsResponse(experiments));
        }),
      );
      try {
        renderPage();
        await screen.findByText('Alpha');
        const input = screen.getByRole('combobox', { name: 'Add filter' });
        input.focus();
        fireEvent.change(input, { target: { value: 'Experiments' } });
        await screen.findByRole('option', { name: 'Experiments' });
        // Typed text lands on the search field first, so the named field is one ArrowDown away.
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.change(input, { target: { value: 'With experiments' } });
        await screen.findByRole('option', { name: 'With experiments' });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());

        release();
        expect(await screen.findByText('Alpha')).not.toBeNull();
      } finally {
        release();
      }
    });
  });

  describe('when experiment summaries fail to load', () => {
    it('keeps successfully loaded datasets available with an unavailable summary', async () => {
      useDatasets([buildDataset({ name: 'Alpha' })]);
      server.use(http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json({}, { status: 500 })));

      renderPage();

      expect(await screen.findByLabelText('Experiment summary unavailable for Alpha')).not.toBeNull();
      expect(screen.getByRole('link', { name: /Alpha/ }).getAttribute('href')).toBe('/datasets/dataset-1');
      expect(screen.queryByText('Failed to load datasets')).toBeNull();
    });
  });
});
