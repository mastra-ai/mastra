import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
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
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { toast } = await import('@mastra/playground-ui/utils/toast');

const BASE_URL = 'http://localhost:4111';

type DependentsStub = {
  dependents: Array<{ id: string; name: string }>;
  hiddenCount?: number;
};

const stubAgentDependents = (agentId: string, payload: DependentsStub = { dependents: [] }) => {
  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${agentId}/dependents`, () =>
      HttpResponse.json({
        dependents: payload.dependents,
        hiddenCount: payload.hiddenCount ?? 0,
      }),
    ),
  );
};

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
    stubAgentDependents('agent-123');
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the confirmation dialog with the agent name when clicked', async () => {
    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    const button = screen.getByTestId('agent-builder-delete-agent');
    expect(button.textContent).toBe('Delete agent');

    fireEvent.click(button);

    const dialog = await screen.findByTestId('agent-builder-delete-agent-dialog');
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
    await waitFor(() => {
      expect((screen.getByTestId('agent-builder-delete-agent-confirm') as HTMLButtonElement).disabled).toBe(false);
    });
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
    const confirmBtn = await screen.findByTestId('agent-builder-delete-agent-confirm');
    await waitFor(() => {
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(await screen.findByTestId('agent-builder-delete-agent-dialog')).toBeTruthy();
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
    stubAgentDependents('agent-123');
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

describe('DeleteAgentDialog impact warnings', () => {
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

  it('renders nothing when there are no dependents and no hidden references', async () => {
    stubAgentDependents('agent-123', { dependents: [], hiddenCount: 0 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));
    await screen.findByTestId('agent-builder-delete-agent-dialog');
    await waitFor(() => {
      expect((screen.getByTestId('agent-builder-delete-agent-confirm') as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByTestId('agent-impact-warnings')).toBeNull();
  });

  it('lists dependent agents by name and truncates after five', async () => {
    stubAgentDependents('agent-123', {
      dependents: [
        { id: 'a1', name: 'Alpha' },
        { id: 'a2', name: 'Beta' },
        { id: 'a3', name: 'Gamma' },
        { id: 'a4', name: 'Delta' },
        { id: 'a5', name: 'Epsilon' },
        { id: 'a6', name: 'Zeta' },
        { id: 'a7', name: 'Eta' },
      ],
    });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const warning = await screen.findByTestId('agent-impact-dependents-warning');
    expect(warning.textContent).toContain('used as a sub-agent');
    expect(screen.getAllByTestId('agent-impact-dependent')).toHaveLength(5);
    expect((await screen.findByTestId('agent-impact-dependents-more')).textContent).toContain('2 more');
  });

  it('surfaces hiddenCount for cross-workspace private dependents', async () => {
    stubAgentDependents('agent-123', { dependents: [], hiddenCount: 3 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const hidden = await screen.findByTestId('agent-impact-hidden-warning');
    expect(hidden.textContent).toContain('3 other private agents also reference this agent.');
  });

  it('singularizes the hiddenCount line when exactly one private dependent', async () => {
    stubAgentDependents('agent-123', { dependents: [], hiddenCount: 1 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const hidden = await screen.findByTestId('agent-impact-hidden-warning');
    expect(hidden.textContent).toContain('1 other private agent also references this agent.');
  });
});
