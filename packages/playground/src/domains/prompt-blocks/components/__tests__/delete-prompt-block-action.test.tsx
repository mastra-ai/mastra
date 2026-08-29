import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeletePromptBlockButton } from '../delete-prompt-block-action';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { toast } = await import('@mastra/playground-ui/utils/toast');

const BASE_URL = 'http://localhost:4111';

const navigate = vi.fn();

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
          <MemoryRouter>{children}</MemoryRouter>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('DeletePromptBlockButton', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    navigate.mockReset();
    (toast.success as ReturnType<typeof vi.fn>).mockReset();
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the confirmation dialog with the block name when clicked', async () => {
    render(
      <Wrapper>
        <DeletePromptBlockButton blockId="block-123" blockName="My Prompt Block" />
      </Wrapper>,
    );

    const button = screen.getByTestId('delete-prompt-block');
    expect(button.textContent).toContain('Delete');

    fireEvent.click(button);

    const dialog = await screen.findByTestId('delete-prompt-block-dialog');
    expect(dialog.textContent).toContain('My Prompt Block');
  });

  it('does not fire a DELETE request when the user cancels', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/prompt-blocks/block-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeletePromptBlockButton blockId="block-123" blockName="My Prompt Block" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('delete-prompt-block'));
    fireEvent.click(screen.getByTestId('delete-prompt-block-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('delete-prompt-block-dialog')).toBeNull();
    });
    expect(deleteCalled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('calls DELETE, toasts success, and navigates after the request resolves', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/prompt-blocks/block-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeletePromptBlockButton blockId="block-123" blockName="My Prompt Block" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('delete-prompt-block'));
    const confirmBtn = await screen.findByTestId('delete-prompt-block-confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Prompt block deleted');
    });
    expect(navigate).toHaveBeenCalledWith(stubLinkPaths.promptBlocksLink());
  });

  it('toasts an error and keeps the dialog open when the DELETE fails', async () => {
    server.use(
      http.delete(`${BASE_URL}/api/stored/prompt-blocks/block-123`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    render(
      <Wrapper>
        <DeletePromptBlockButton blockId="block-123" blockName="My Prompt Block" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('delete-prompt-block'));
    const confirmBtn = await screen.findByTestId('delete-prompt-block-confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(await screen.findByTestId('delete-prompt-block-dialog')).toBeTruthy();
  });
});
