import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import DatasetsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { buildListExperimentsResponse } from '@/domains/experiments/components/__tests__/fixtures/experiments';
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
      {/* Real react-router Link so the C shortcut's synthetic click navigates the MemoryRouter. */}
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <LocationProbe />
        <Routes>
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

beforeEach(() => {
  listRequests = [];
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

  describe('header create action', () => {
    beforeEach(() => useDatasets());

    it('shows a New dataset link to the create page in the header slot', async () => {
      renderPage();

      const link = await screen.findByRole('link', { name: 'New dataset' });
      expect(link.getAttribute('href')).toBe('/datasets/new');
    });

    it('navigates to the create page when pressing C', async () => {
      renderPage();

      await screen.findByRole('link', { name: 'New dataset' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create dataset page')).not.toBeNull();
    });
  });

  describe('when there are no datasets', () => {
    it('still shows the New dataset link in the header slot', async () => {
      useDatasets([]);
      renderPage();

      const link = await screen.findByRole('link', { name: 'New dataset' });
      expect(link.getAttribute('href')).toBe('/datasets/new');
    });
  });
});
