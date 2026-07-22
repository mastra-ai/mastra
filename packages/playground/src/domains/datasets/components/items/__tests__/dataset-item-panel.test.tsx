// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { itemScorers } from '../../__tests__/fixtures/item-scorers';
import { DatasetItemPanel } from '../dataset-item-panel';
import { baseItem, itemWithEmptyScorers, itemWithMocks, itemWithScorers } from './fixtures/dataset-item-panel';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderPanel = (item: DatasetItem) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DatasetItemPanel datasetId="ds-1" item={item} items={[item]} onItemChange={() => {}} onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const useScorerHandler = () => {
  server.use(http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(itemScorers)));
};

const enterEditMode = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actions menu' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
};

const openScorerSelector = async () => {
  const selector = await screen.findByRole('combobox');
  await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false));
  fireEvent.click(selector);
};

const selectScorer = async (name: string) => {
  await openScorerSelector();
  const option = await screen.findByRole('option', { name: new RegExp(name, 'i') });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
};

afterEach(() => cleanup());

describe('DatasetItemPanel', () => {
  describe('when item details are viewed', () => {
    it('renders persisted tool mocks', () => {
      renderPanel(itemWithMocks);

      expect(screen.getByText('Tool Mocks')).not.toBeNull();
      expect(screen.getByText(/getWeather/)).not.toBeNull();
    });

    it('shows that absent scorer IDs inherit from the dataset', () => {
      renderPanel(baseItem);

      expect(screen.getByText('Scorers')).not.toBeNull();
      expect(screen.getByText('Inherited from dataset')).not.toBeNull();
    });

    it('distinguishes an explicit empty scorer override from inheritance', () => {
      renderPanel(itemWithEmptyScorers);

      expect(screen.getByText('Scorers')).not.toBeNull();
      expect(screen.queryByText('Inherited from dataset')).toBeNull();
    });
  });

  describe('when an inherited item is edited', () => {
    it('starts with the dataset scorer override disabled', async () => {
      renderPanel(baseItem);
      await enterEditMode();

      expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('offers only resolvable registered and stored scorers', async () => {
      useScorerHandler();
      renderPanel(baseItem);
      await enterEditMode();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await openScorerSelector();

      expect(await screen.findByRole('option', { name: /Quality scorer/i })).not.toBeNull();
      expect(screen.getByRole('option', { name: /Stored judge/i })).not.toBeNull();
      expect(screen.queryByRole('option', { name: /Unavailable scorer/i })).toBeNull();
    });

    it('persists selected scorer IDs through the dataset item API', async () => {
      useScorerHandler();
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json({ ...itemWithScorers, datasetVersion: 2, scorerIds: ['stored-judge'] });
        }),
      );
      renderPanel(baseItem);
      await enterEditMode();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      await selectScorer('Stored judge');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({ scorerIds: ['stored-judge'] });
    });

    it('persists an enabled override with no selection as an empty array', async () => {
      useScorerHandler();
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json({ ...itemWithEmptyScorers, datasetVersion: 2 });
        }),
      );
      renderPanel(baseItem);
      await enterEditMode();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({ scorerIds: [] });
    });
  });

  describe('when an existing scorer override is edited', () => {
    it('persists null when the override is disabled', async () => {
      const capture = vi.fn<(body: unknown) => void>();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json({ ...baseItem, datasetVersion: 2 });
        }),
      );
      renderPanel(itemWithScorers);
      await enterEditMode();

      const toggle = screen.getByRole('switch', { name: 'Override dataset scorers' });
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      fireEvent.click(toggle);
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0]?.[0]).toMatchObject({ scorerIds: null });
    });

    it('restores the persisted override after canceling edits', async () => {
      useScorerHandler();
      renderPanel(itemWithScorers);
      await enterEditMode();

      fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await enterEditMode();

      expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
        'true',
      );
      expect(await screen.findByRole('combobox')).not.toBeNull();
      expect(screen.getByRole('combobox').textContent).toContain('1 selected');
    });
  });
});
