// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatasetCrumb } from '../dataset-crumb';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const datasets = [
  { id: 'ds-1', name: 'Weather evals', version: 1 },
  { id: 'ds-2', name: 'Support evals', version: 1 },
];

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets, pagination: { total: 2, page: 0 } })),
  );
});

afterEach(() => cleanup());

const renderCrumb = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter initialEntries={['/datasets/ds-1/items/item-1']}>
            <Routes>
              <Route path="/datasets/:datasetId/items/:itemId" element={<DatasetCrumb />} />
            </Routes>
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('DatasetCrumb', () => {
  it('renders the dataset name as a link to the dataset page', async () => {
    renderCrumb();

    const link = await screen.findByRole('link', { name: 'Weather evals' });
    expect(link.getAttribute('href')).toBe('/datasets/ds-1');
  });

  it('opens the dataset switcher only from the arrow trigger', async () => {
    renderCrumb();

    await screen.findByRole('link', { name: 'Weather evals' });
    expect(screen.queryByPlaceholderText('Search datasets...')).toBeNull();

    fireEvent.click(screen.getByRole('combobox', { name: 'Switch dataset' }));

    expect(await screen.findByPlaceholderText('Search datasets...')).toBeDefined();
    expect(screen.getByText('Support evals')).toBeDefined();
  });
});
