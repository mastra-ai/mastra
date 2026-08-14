// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { itemScorers } from '../../__tests__/fixtures/item-scorers';
import { DatasetItemPanel } from '../dataset-item-panel';
import {
  baseItem,
  itemWithEmptyScorers,
  itemWithMocks,
  itemWithScorers,
  itemWithTimeout,
} from './fixtures/dataset-item-panel';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const scorerControlTestTimeout = 15_000;

const anotherItemWithTimeout = {
  ...itemWithTimeout,
  id: 'item-2',
  timeout: 30_000,
} satisfies DatasetItem;

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const renderPanel = (item: DatasetItem) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const renderPanelWithItem = (currentItem: DatasetItem) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DatasetItemPanel
            datasetId="ds-1"
            item={currentItem}
            items={[currentItem]}
            onItemChange={() => {}}
            onClose={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const rendered = render(renderPanelWithItem(item));

  return {
    ...rendered,
    rerenderPanel: (nextItem: DatasetItem) => rendered.rerender(renderPanelWithItem(nextItem)),
  };
};

const useScorerHandler = () => {
  server.use(http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(itemScorers)));
};

const enterEditMode = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actions menu' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
};

async function openEditForm() {
  await enterEditMode();
  return screen.findByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i });
}

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
    it(
      'starts with the dataset scorer override disabled',
      async () => {
        renderPanel(baseItem);
        await enterEditMode();

        expect(screen.getByRole('switch', { name: 'Override dataset scorers' }).getAttribute('aria-checked')).toBe(
          'false',
        );
        expect(screen.queryByRole('combobox')).toBeNull();
      },
      scorerControlTestTimeout,
    );

    it(
      'offers only resolvable registered and stored scorers',
      async () => {
        useScorerHandler();
        renderPanel(baseItem);
        await enterEditMode();

        fireEvent.click(screen.getByRole('switch', { name: 'Override dataset scorers' }));
        await openScorerSelector();

        expect(await screen.findByRole('option', { name: /Quality scorer/i })).not.toBeNull();
        expect(screen.getByRole('option', { name: /Stored judge/i })).not.toBeNull();
        expect(screen.queryByRole('option', { name: /Unavailable scorer/i })).toBeNull();
      },
      scorerControlTestTimeout,
    );

    it(
      'persists selected scorer IDs through the dataset item API',
      async () => {
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
      },
      scorerControlTestTimeout,
    );

    it(
      'persists an enabled override with no selection as an empty array',
      async () => {
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
      },
      scorerControlTestTimeout,
    );
  });

  describe('when an existing scorer override is edited', () => {
    it(
      'persists null when the override is disabled',
      async () => {
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
      },
      scorerControlTestTimeout,
    );

    it(
      'restores the persisted override after canceling edits',
      async () => {
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
      },
      scorerControlTestTimeout,
    );
  });

  describe('when the item inherits the experiment timeout', () => {
    it('omits the item timeout metadata row', () => {
      renderPanel(baseItem);

      expect(screen.queryByText('Item timeout')).toBeNull();
    });
  });

  describe('when the item has a timeout override', () => {
    it('renders the formatted timeout in view mode', () => {
      renderPanel(itemWithTimeout);

      expect(screen.getByText('Item timeout')).not.toBeNull();
      expect(screen.getByText('15,000 ms')).not.toBeNull();
    });

    it('prepopulates the timeout field in edit mode', async () => {
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();

      expect(timeout.value).toBe('15000');
    });

    it('posts a changed timeout through the real mutation', async () => {
      const capture = vi.fn();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json({ ...itemWithTimeout, timeout: 1_800_000 });
        }),
      );
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '1800000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(expect.objectContaining({ timeout: 1_800_000 }));
    });
  });

  describe('when item data changes during editing', () => {
    it('resets drafts when a different item is selected', async () => {
      const { rerenderPanel } = renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '25000' } });
      rerenderPanel(anotherItemWithTimeout);

      expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i }).value).toBe('30000');
    });

    it('preserves drafts when the same item is refetched', async () => {
      const { rerenderPanel } = renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '25000' } });
      rerenderPanel({ ...itemWithTimeout, metadata: { refetched: true } });

      expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i }).value).toBe('25000');
    });
  });

  describe('when a timeout edit is cancelled', () => {
    it('remounts the original timeout on the next edit', async () => {
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '30000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      const reopenedTimeout = await openEditForm();

      expect(reopenedTimeout.value).toBe('15000');
    });
  });

  describe('when a persisted timeout is blanked', () => {
    it('rejects the unsupported clear operation before making a request', async () => {
      const capture = vi.fn();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(itemWithTimeout);
        }),
      );
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'An existing item timeout cannot be cleared; enter a positive integer no greater than 30 minutes',
        ),
      );
      expect(capture).not.toHaveBeenCalled();
    });
  });

  describe('when the edited timeout is outside the supported range', () => {
    it.each(['0', '-1', '1.5', '1800001'])('rejects %s before making a request', async timeoutValue => {
      const capture = vi.fn();
      server.use(
        http.patch(`${BASE_URL}/api/datasets/ds-1/items/item-1`, async ({ request }) => {
          capture(await request.json());
          return HttpResponse.json(itemWithTimeout);
        }),
      );
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: timeoutValue } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Item timeout must be a positive integer no greater than 1,800,000 milliseconds (30 minutes)',
        ),
      );
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
