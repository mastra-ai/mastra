// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DatasetItemsComparePage from '../index';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const dataset = {
  id: 'ds-1',
  name: 'Weather evals',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const now = new Date().toISOString();

const items = [
  { id: 'item-a', datasetId: 'ds-1', input: { q: 'a' }, groundTruth: null, metadata: null, version: 1 },
  { id: 'item-b', datasetId: 'ds-1', input: { q: 'b' }, groundTruth: null, metadata: null, version: 1 },
  { id: 'item-c', datasetId: 'ds-1', input: { q: 'c' }, groundTruth: null, metadata: null, version: 1 },
].map(item => ({ ...item, createdAt: now, updatedAt: now }));

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets/ds-1`, () => HttpResponse.json(dataset)),
    http.get(`${BASE_URL}/api/datasets/ds-1/items`, () =>
      HttpResponse.json({ items, pagination: { total: items.length, page: 0, perPage: 10 } }),
    ),
    http.get(`${BASE_URL}/api/datasets/ds-1/items/:itemId`, ({ params }) => {
      const item = items.find(i => i.id === params.itemId);
      return item ? HttpResponse.json(item) : new HttpResponse(null, { status: 404 });
    }),
  );
});

afterEach(() => cleanup());

const renderPage = (initialEntry = '/datasets/ds-1/items/item-a/compare/item-b') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route
                path="/datasets/:datasetId/items/:itemId/compare/:secondItemId"
                element={<DatasetItemsComparePage />}
              />
            </Routes>
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('DatasetItemsComparePage', () => {
  it('compares the two items named in the URL path', async () => {
    renderPage();

    expect(await screen.findByText('Compare Dataset Items')).toBeDefined();
    // Each column has an item selector pre-filled with its path param item.
    expect((await screen.findAllByText('item-a')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('item-b')).length).toBeGreaterThan(0);
  });

  it('links each column to that item detail page via Versions', async () => {
    renderPage();

    await screen.findByText('Compare Dataset Items');
    const versionLinks = await screen.findAllByRole('link', { name: /versions/i });
    expect(versionLinks.map(l => l.getAttribute('href'))).toEqual([
      '/datasets/ds-1/items/item-a',
      '/datasets/ds-1/items/item-b',
    ]);
  });
});
