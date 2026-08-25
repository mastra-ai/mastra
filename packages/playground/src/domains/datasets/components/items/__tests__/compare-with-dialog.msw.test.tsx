// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetItemPanel } from '../dataset-item-panel';
import { baseItem } from './fixtures/dataset-item-panel';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const now = new Date().toISOString();

const allItems = [
  { ...baseItem },
  { id: 'item-b', datasetId: 'ds-1', input: { q: 'beta' }, datasetVersion: 1, createdAt: now, updatedAt: now },
  { id: 'item-c', datasetId: 'ds-1', input: { q: 'gamma' }, datasetVersion: 1, createdAt: now, updatedAt: now },
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

const renderPanel = () => {
  const navigate = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
          <MemoryRouter>
            <DatasetItemPanel
              datasetId="ds-1"
              item={baseItem}
              items={[baseItem]}
              onItemChange={() => {}}
              onClose={() => {}}
            />
          </MemoryRouter>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return { navigate };
};

const openCompareDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actions menu' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /compare with/i }));
  return screen.findByRole('dialog', { name: /compare with/i });
};

describe('Compare with dialog', () => {
  describe('when "Compare with…" is picked from the actions menu', () => {
    it('opens a dialog listing the other dataset items, excluding the open item', async () => {
      renderPanel();

      const dialog = await openCompareDialog();

      expect(await within(dialog).findByText('item-b')).toBeDefined();
      expect(within(dialog).getByText('item-c')).toBeDefined();
      expect(dialog.textContent).not.toContain(baseItem.id);
    });
  });

  describe('when searching inside the dialog', () => {
    it('filters the item list', async () => {
      renderPanel();
      const dialog = await openCompareDialog();
      await within(dialog).findByText('item-b');

      fireEvent.change(within(dialog).getByPlaceholderText('Search items...'), { target: { value: 'item-c' } });

      await waitFor(() => expect(within(dialog).queryByText('item-b')).toBeNull(), { timeout: 3000 });
      expect(await within(dialog).findByText('item-c')).toBeDefined();
    });
  });

  describe('when an item is picked', () => {
    it('navigates to the compare page for the current item pair and closes the dialog', async () => {
      const { navigate } = renderPanel();
      const dialog = await openCompareDialog();

      fireEvent.click(await within(dialog).findByText('item-b'));

      expect(navigate).toHaveBeenCalledWith(`/datasets/ds-1/items/${baseItem.id}/compare/item-b`);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /compare with/i })).toBeNull());
    });
  });
});
