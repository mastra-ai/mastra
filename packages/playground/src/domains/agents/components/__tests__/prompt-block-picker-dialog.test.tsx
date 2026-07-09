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
  it('shows a loading state while the prompt block list is in flight', async () => {
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

  it('shows the empty state when there are no prompt blocks', async () => {
    server.use(http.get(`${BASE_URL}/api/stored/prompt-blocks`, () => HttpResponse.json(storedPromptBlockList([]))));

    renderDialog();

    expect(await screen.findByText('No prompt blocks available')).not.toBeNull();
  });

  it('flags a draft block as skipped at runtime but leaves a published block unmarked', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        HttpResponse.json(
          storedPromptBlockList([
            promptBlock({ id: 'draft-block', name: 'Draft Block', status: 'draft' }),
            promptBlock({ id: 'live-block', name: 'Live Block', status: 'published', activeVersionId: 'v1' }),
          ]),
        ),
      ),
    );

    renderDialog();

    // The draft carries the badge + runtime note; the published block does not.
    expect(await screen.findByText('Draft Block')).not.toBeNull();
    expect(screen.getByText('Unpublished — skipped at runtime until published')).not.toBeNull();

    const draftBadges = screen.getAllByText('Draft');
    expect(draftBadges).toHaveLength(1);
  });

  it('filters the list by the search term and shows a no-matches state', async () => {
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

  it('selects a block and closes the dialog when a row is clicked', async () => {
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
