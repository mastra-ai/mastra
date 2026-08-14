import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptBlockPickerDialog } from '../agent-cms-blocks/prompt-block-picker-dialog';
import { promptBlock, storedPromptBlockList } from './fixtures/prompt-blocks';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderDialog = (props?: { onSelect?: (id: string) => void; onOpenChange?: (open: boolean) => void }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <PromptBlockPickerDialog
          open
          onOpenChange={props?.onOpenChange ?? (() => {})}
          onSelect={props?.onSelect ?? (() => {})}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('PromptBlockPickerDialog', () => {
  describe('when the prompt block list is loading', () => {
    it('shows a loading state', async () => {
      // Gate the handler so the query stays pending and the spinner state is observable.
      let resolveList: () => void = () => {};
      const listReady = new Promise<void>(resolve => {
        resolveList = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks`, async () => {
          await listReady;
          return HttpResponse.json(storedPromptBlockList([]));
        }),
      );

      renderDialog();

      expect(await screen.findByText('Loading prompt blocks...')).not.toBeNull();

      resolveList();
      await waitFor(() => expect(screen.queryByText('Loading prompt blocks...')).toBeNull());
    });
  });

  describe('when there are no prompt blocks', () => {
    it('shows the empty state', async () => {
      server.use(http.get(`${BASE_URL}/api/stored/prompt-blocks`, () => HttpResponse.json(storedPromptBlockList([]))));

      renderDialog();

      expect(await screen.findByText('No prompt blocks available')).not.toBeNull();
    });
  });

  describe('when the list contains draft and published blocks', () => {
    it('requests and displays only published blocks', async () => {
      const onListPromptBlocks = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks`, ({ request }) => {
          onListPromptBlocks(new URL(request.url).searchParams.get('status'));
          return HttpResponse.json(
            storedPromptBlockList([
              promptBlock({ id: 'live-block', name: 'Live Block', status: 'published', activeVersionId: 'v1' }),
            ]),
          );
        }),
      );

      renderDialog();

      expect(await screen.findByText('Live Block')).not.toBeNull();
      expect(screen.queryByText('Draft Block')).toBeNull();
      expect(onListPromptBlocks).toHaveBeenCalledWith('published');
    });
  });

  describe('when a published block has unpublished edits', () => {
    it('keeps the published block available for selection', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
          HttpResponse.json(
            storedPromptBlockList([
              promptBlock({
                id: 'edited-block',
                name: 'Published Block With Edits',
                status: 'published',
                activeVersionId: 'v1',
                hasDraft: true,
              }),
            ]),
          ),
        ),
      );

      renderDialog();

      expect(await screen.findByText('Published Block With Edits')).not.toBeNull();
    });
  });

  describe('when the user searches the list', () => {
    it('filters blocks and shows the no-matches state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
          HttpResponse.json(
            storedPromptBlockList([
              promptBlock({ id: 'billing', name: 'Billing tone', status: 'published', activeVersionId: 'v1' }),
              promptBlock({ id: 'support', name: 'Support tone', status: 'published', activeVersionId: 'v1' }),
            ]),
          ),
        ),
      );

      renderDialog();

      await screen.findByText('Billing tone');

      const searchInput = screen.getByPlaceholderText('Search prompt blocks...');
      fireEvent.change(searchInput, { target: { value: 'billing' } });

      expect(screen.getByText('Billing tone')).not.toBeNull();
      expect(screen.queryByText('Support tone')).toBeNull();

      fireEvent.change(searchInput, { target: { value: 'nothing matches' } });
      expect(screen.getByText('No matching prompt blocks')).not.toBeNull();
    });
  });

  describe('when the user selects a block', () => {
    it('selects the block and closes the dialog', async () => {
      const onSelect = vi.fn();
      const onOpenChange = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
          HttpResponse.json(
            storedPromptBlockList([
              promptBlock({ id: 'billing', name: 'Billing tone', status: 'published', activeVersionId: 'v1' }),
            ]),
          ),
        ),
      );

      renderDialog({ onSelect, onOpenChange });

      fireEvent.click(await screen.findByText('Billing tone'));

      expect(onSelect).toHaveBeenCalledWith('billing');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
