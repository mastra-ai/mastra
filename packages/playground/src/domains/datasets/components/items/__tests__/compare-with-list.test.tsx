// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CompareWithList } from '../compare-with-list';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const now = new Date().toISOString();

const allItems = [
  { id: 'item-a', datasetId: 'ds-1', input: { q: 'alpha' }, version: 1, createdAt: now, updatedAt: now },
  { id: 'item-b', datasetId: 'ds-1', input: { q: 'beta' }, version: 1, createdAt: now, updatedAt: now },
  { id: 'item-c', datasetId: 'ds-1', input: { q: 'gamma' }, version: 1, createdAt: now, updatedAt: now },
];

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets/ds-1/items`, ({ request }) => {
      const search = new URL(request.url).searchParams.get('search');
      const items = search ? allItems.filter(i => i.id.includes(search)) : allItems;
      return HttpResponse.json({ items, pagination: { total: items.length, page: 0, perPage: 10 } });
    }),
  );
});

afterEach(() => cleanup());

const renderList = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter>
            <CompareWithList datasetId="ds-1" currentItemId="item-a" />
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('CompareWithList', () => {
  it('lists the other dataset items, excluding the currently open item', async () => {
    renderList();

    expect(await screen.findByText('item-b')).toBeDefined();
    expect(screen.getByText('item-c')).toBeDefined();
    expect(screen.queryByText('item-a')).toBeNull();
  });

  it('links each row to the compare page for the current item pair', async () => {
    renderList();

    const row = (await screen.findByText('item-b')).closest('a');
    expect(row?.getAttribute('href')).toBe('/datasets/ds-1/items/item-a/compare/item-b');
  });

  it('filters the list when searching', async () => {
    renderList();

    await screen.findByText('item-b');
    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'item-c' } });

    await waitFor(() => expect(screen.queryByText('item-b')).toBeNull(), { timeout: 3000 });
    expect(await screen.findByText('item-c')).toBeDefined();
  });
});
