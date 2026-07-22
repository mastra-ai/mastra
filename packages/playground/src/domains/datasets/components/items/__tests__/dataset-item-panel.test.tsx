// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasetItemPanel } from '../dataset-item-panel';
import { baseItem, itemWithMocks, itemWithTimeout } from './fixtures/dataset-item-panel';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

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

async function openEditForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Actions menu' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  return screen.findByRole<HTMLInputElement>('spinbutton', { name: /item timeout/i });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DatasetItemPanel', () => {
  describe('when the item has Tool Mocks', () => {
    it('renders the mocks in view mode', () => {
      renderPanel(itemWithMocks);

      expect(screen.getByText('Tool Mocks')).not.toBeNull();
      expect(screen.getByText(/getWeather/)).not.toBeNull();
    });
  });

  describe('when the item has no Tool Mocks', () => {
    it('still renders the Tool Mocks section', () => {
      renderPanel(baseItem);

      expect(screen.getByText('Tool Mocks')).not.toBeNull();
    });
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
          return HttpResponse.json({ ...itemWithTimeout, timeout: 30_000 });
        }),
      );
      renderPanel(itemWithTimeout);

      const timeout = await openEditForm();
      fireEvent.change(timeout, { target: { value: '30000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30_000 }));
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
          'An existing item timeout cannot be cleared; enter a positive whole number',
        ),
      );
      expect(capture).not.toHaveBeenCalled();
    });
  });

  describe('when the edited timeout is not a positive whole number', () => {
    it.each(['0', '-1', '1.5'])('rejects %s before making a request', async timeoutValue => {
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

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Item timeout must be a positive whole number'));
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
