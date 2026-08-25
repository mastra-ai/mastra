// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DatasetItemVersionsComparePage from '../index';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const dataset = {
  id: 'ds-1',
  name: 'Weather evals',
  version: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const now = new Date().toISOString();

const history = [
  {
    id: 'item-a',
    datasetId: 'ds-1',
    datasetVersion: 2,
    input: { q: 'newer' },
    groundTruth: null,
    metadata: null,
    validTo: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-a',
    datasetId: 'ds-1',
    datasetVersion: 1,
    input: { q: 'older' },
    groundTruth: null,
    metadata: null,
    validTo: 2,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
];

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets/ds-1`, () => HttpResponse.json(dataset)),
    http.get(`${BASE_URL}/api/datasets/ds-1/items/item-a/history`, () => HttpResponse.json({ history })),
    http.get(`${BASE_URL}/api/datasets/ds-1/items/item-a/versions/:version`, ({ params }) => {
      const version = history.find(v => String(v.datasetVersion) === params.version);
      return version ? HttpResponse.json(version) : new HttpResponse(null, { status: 404 });
    }),
  );
});

afterEach(() => cleanup());

const renderPage = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/datasets/:datasetId/items/:itemId/versions" element={<DatasetItemVersionsComparePage />} />
            </Routes>
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('DatasetItemVersionsComparePage', () => {
  it('shows the version history when no ?ids are provided', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions');

    expect(await screen.findByRole('heading', { name: 'Item Version History' })).toBeDefined();
    // Both history rows are listed.
    expect(await screen.findByText('v. 2')).toBeDefined();
    expect(await screen.findByText('v. 1')).toBeDefined();
  });

  it('shows the compare view when two ?ids are provided', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions?ids=1,2');

    expect(await screen.findByText('Compare Dataset Item Versions')).toBeDefined();
  });
});
