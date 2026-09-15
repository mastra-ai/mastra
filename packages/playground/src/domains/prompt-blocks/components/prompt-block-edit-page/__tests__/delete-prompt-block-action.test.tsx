import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeletePromptBlockAction } from '../delete-prompt-block-action';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { toast } = await import('@mastra/playground-ui/utils/toast');

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

const renderAction = (props?: { blockId?: string; blockName?: string }) =>
  renderWithProviders(
    <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
      <DeletePromptBlockAction blockId={props?.blockId ?? 'block-123'} blockName={props?.blockName ?? 'My Block'} />
    </LinkComponentProvider>,
  );

describe('DeletePromptBlockAction', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    navigate.mockReset();
    (toast.success as ReturnType<typeof vi.fn>).mockReset();
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  it('opens the confirmation dialog with the block name when clicked', async () => {
    renderAction({ blockName: 'My Block' });

    fireEvent.click(screen.getByTestId('prompt-block-delete'));

    const dialog = await screen.findByTestId('prompt-block-delete-dialog');
    expect(dialog.textContent).toContain('My Block');
  });

  it('does not fire a DELETE request when the user cancels', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${TEST_BASE_URL}/api/stored/prompt-blocks/block-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    renderAction();

    fireEvent.click(screen.getByTestId('prompt-block-delete'));
    fireEvent.click(await screen.findByTestId('prompt-block-delete-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('prompt-block-delete-dialog')).toBeNull();
    });
    expect(deleteCalled).toBe(false);
  });

  it('calls DELETE, toasts success, and navigates after the request resolves', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${TEST_BASE_URL}/api/stored/prompt-blocks/block-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    renderAction();

    fireEvent.click(screen.getByTestId('prompt-block-delete'));
    fireEvent.click(await screen.findByTestId('prompt-block-delete-confirm'));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Prompt block deleted');
    });
    expect(navigate).toHaveBeenCalledWith('/prompt-blocks');
  });

  it('toasts an error and keeps the dialog open when the DELETE fails', async () => {
    server.use(
      http.delete(`${TEST_BASE_URL}/api/stored/prompt-blocks/block-123`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    renderAction();

    fireEvent.click(screen.getByTestId('prompt-block-delete'));
    fireEvent.click(await screen.findByTestId('prompt-block-delete-confirm'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(await screen.findByTestId('prompt-block-delete-dialog')).toBeTruthy();
  });
});
