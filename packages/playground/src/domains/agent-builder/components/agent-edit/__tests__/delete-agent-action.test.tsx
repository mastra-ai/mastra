// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { DropdownMenu, TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAgentPanelButton, DeleteAgentMenuItem } from '../delete-agent-action';
import { server } from '@/test/msw-server';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

const { toast } = await import('@mastra/playground-ui');

const BASE_URL = 'http://localhost:4111';

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
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('DeleteAgentPanelButton', () => {
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

  it('opens the confirmation dialog with the agent name when clicked', () => {
    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    const button = screen.getByTestId('agent-builder-delete-agent');
    expect(button.textContent).toContain('Delete agent');

    fireEvent.click(button);

    const dialog = screen.getByTestId('agent-builder-delete-agent-dialog');
    expect(dialog.textContent).toContain('My Agent');
  });

  it('does not fire a DELETE request when the user cancels', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/agents/agent-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));
    fireEvent.click(screen.getByTestId('agent-builder-delete-agent-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-delete-agent-dialog')).toBeNull();
    });
    expect(deleteCalled).toBe(false);
  });

  it('calls DELETE, toasts success, and navigates after the request resolves', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/agents/agent-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));
    fireEvent.click(screen.getByTestId('agent-builder-delete-agent-confirm'));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Agent deleted');
    });
    expect(navigate).toHaveBeenCalledWith('/agent-builder/agents', { viewTransition: true });
  });

  it('toasts an error and keeps the dialog open when the DELETE fails', async () => {
    server.use(
      http.delete(`${BASE_URL}/api/stored/agents/agent-123`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));
    fireEvent.click(screen.getByTestId('agent-builder-delete-agent-confirm'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('agent-builder-delete-agent-dialog')).toBeTruthy();
  });
});

describe('DeleteAgentMenuItem', () => {
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

  it('opens the confirmation dialog from inside a dropdown menu without auto-closing it', async () => {
    render(
      <Wrapper>
        <DropdownMenu open>
          <DropdownMenu.Trigger data-testid="dropdown-trigger">More</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DeleteAgentMenuItem agentId="agent-123" agentName="My Agent" />
          </DropdownMenu.Content>
        </DropdownMenu>
      </Wrapper>,
    );

    const item = await screen.findByTestId('agent-builder-mobile-menu-delete');
    fireEvent.click(item);

    const dialog = await screen.findByTestId('agent-builder-delete-agent-dialog');
    expect(dialog.textContent).toContain('My Agent');
  });
});
