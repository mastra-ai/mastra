import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import PromptBlocksPage from '..';
import { fewPromptBlocks, pagedPromptBlocks, systemPackages } from './fixtures/prompt-blocks';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const onListRequest = vi.fn<(page: number, perPage: number) => void>();

const usePagedPromptBlocks = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks`, ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? 0);
      const perPage = Number(url.searchParams.get('perPage') ?? 100);
      onListRequest(page, perPage);
      return HttpResponse.json(pagedPromptBlocks(page, perPage));
    }),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
  );
};

const renderPage = () =>
  renderWithProviders(
    <TestLinkProvider>
      <PromptBlocksPage />
    </TestLinkProvider>,
  );

describe('Prompt Blocks page', () => {
  it('requests 50 blocks per page and renders pagination controls', async () => {
    usePagedPromptBlocks();
    renderPage();

    expect(await screen.findByText('Prompt Block 1')).not.toBeNull();
    expect(screen.getByText('Prompt Block 50')).not.toBeNull();
    expect(screen.queryByText('Prompt Block 51')).toBeNull();

    expect(onListRequest).toHaveBeenCalledWith(0, 50);
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
  });

  it('loads the next and previous pages', async () => {
    usePagedPromptBlocks();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Prompt Block 51')).not.toBeNull();
    expect(screen.queryByText('Prompt Block 1')).toBeNull();
    expect(onListRequest).toHaveBeenCalledWith(1, 50);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText('Prompt Block 1')).not.toBeNull();
  });

  it('resets to the first page when searching', async () => {
    usePagedPromptBlocks();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Prompt Block 51');

    fireEvent.change(screen.getByPlaceholderText('Filter by name or description'), {
      target: { value: 'Prompt Block 2' },
    });

    expect(await screen.findByText('Prompt Block 2')).not.toBeNull();
    expect(screen.queryByText('Prompt Block 51')).toBeNull();
  });

  it('shows no page navigation when all blocks fit on one page', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks`, () => HttpResponse.json(fewPromptBlocks)),
      http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
    );
    renderPage();

    expect(await screen.findByText('Prompt Block 1')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
  });
});
