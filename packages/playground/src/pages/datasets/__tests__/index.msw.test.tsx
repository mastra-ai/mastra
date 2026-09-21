import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import DatasetsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { buildListExperimentsResponse } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const useDatasets = (datasets = [buildDataset()]) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
  );
};

const renderPage = () =>
  renderWithProviders(
    <TooltipProvider>
      <TestLinkProvider>
        <Routes>
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/datasets/new" element={<div>Create dataset page</div>} />
        </Routes>
      </TestLinkProvider>
    </TooltipProvider>,
    { router: { initialEntries: ['/datasets'] } },
  );

describe('Datasets page', () => {
  describe('header create action', () => {
    beforeEach(() => useDatasets());

    it('shows a New dataset button in the header slot', async () => {
      renderPage();

      expect(await screen.findByRole('button', { name: 'New dataset' })).not.toBeNull();
    });

    it('navigates to the create page when pressing C', async () => {
      renderPage();

      await screen.findByRole('button', { name: 'New dataset' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create dataset page')).not.toBeNull();
    });
  });

  describe('when there are no datasets', () => {
    it('still shows the New dataset button in the header slot', async () => {
      useDatasets([]);
      renderPage();

      expect(await screen.findByRole('button', { name: 'New dataset' })).not.toBeNull();
    });
  });
});
