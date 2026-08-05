import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => onListRequest.mockClear());

describe('Prompt Blocks page', () => {
  describe('when there are more blocks than one page', () => {
    it('requests 50 blocks per page', async () => {
      usePagedPromptBlocks();
      renderPage();

      await screen.findByText('Prompt Block 1');

      expect(onListRequest).toHaveBeenCalledWith(0, 50);
    });

    it('shows only the first page of blocks', async () => {
      usePagedPromptBlocks();
      renderPage();

      expect(await screen.findByText('Prompt Block 1')).not.toBeNull();
      expect(screen.getByText('Prompt Block 50')).not.toBeNull();
      expect(screen.queryByText('Prompt Block 51')).toBeNull();
    });

    it('shows a Next control but no Previous control', async () => {
      usePagedPromptBlocks();
      renderPage();

      expect(await screen.findByRole('button', { name: 'Next' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    });
  });

  describe('when navigating between pages', () => {
    it('loads the next page', async () => {
      usePagedPromptBlocks();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

      expect(await screen.findByText('Prompt Block 51')).not.toBeNull();
      expect(screen.queryByText('Prompt Block 1')).toBeNull();
      expect(onListRequest).toHaveBeenCalledWith(1, 50);
    });

    it('returns to the previous page', async () => {
      usePagedPromptBlocks();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      await screen.findByText('Prompt Block 51');

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(await screen.findByText('Prompt Block 1')).not.toBeNull();
    });
  });

  describe('when a page request is in flight', () => {
    it('ignores extra Next clicks until the page arrives', async () => {
      let releaseNextPage: () => void = () => {};
      const gate = new Promise<void>(resolve => {
        releaseNextPage = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks`, async ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page') ?? 0);
          const perPage = Number(url.searchParams.get('perPage') ?? 100);
          onListRequest(page, perPage);
          if (page > 0) await gate;
          return HttpResponse.json(pagedPromptBlocks(page, perPage));
        }),
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
      );
      renderPage();

      const nextButton = await screen.findByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      releaseNextPage();

      expect(await screen.findByText('Prompt Block 51')).not.toBeNull();
      expect(onListRequest).toHaveBeenCalledWith(1, 50);
      expect(onListRequest).not.toHaveBeenCalledWith(2, 50);
    });
  });

  describe('when searching from a later page', () => {
    it('resets to the first page', async () => {
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
  });

  describe('when all blocks fit on one page', () => {
    it('shows no page navigation', async () => {
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
});
