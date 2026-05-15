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

interface StubAgentOptions {
  id?: string;
  name?: string;
  isStarred?: boolean;
  starCount?: number;
}

const stubAgentDetails = ({
  id = 'agent-123',
  name = 'My Agent',
  isStarred = false,
  starCount = 0,
}: StubAgentOptions = {}) =>
  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${id}`, () =>
      HttpResponse.json({ id, name, isStarred, starCount, status: 'draft' }),
    ),
  );

const stubAgentDependents = (
  dependents: Array<{ id: string; name: string }> = [],
  { id = 'agent-123', hiddenCount }: { id?: string; hiddenCount?: number } = {},
) =>
  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${id}/dependents`, () =>
      HttpResponse.json(hiddenCount !== undefined ? { dependents, hiddenCount } : { dependents }),
    ),
  );

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
    // Default to "not starred / no dependents" so the existing tests don't have
    // to think about warning content. Tests that need other states override
    // these with `server.use(...)`.
    stubAgentDetails();
    stubAgentDependents();
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
    // Wait for the dependents lookup to finish so the confirm button is
    // enabled. Without this the click below would be a no-op.
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

  it('does not show any warnings when the agent has no stars or dependents', async () => {
    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    // Wait for the dependents query to settle so any warning block would have
    // had a chance to render.
    await waitFor(() => {
      expect(screen.getByTestId('agent-builder-delete-agent-dialog')).toBeTruthy();
    });
    expect(screen.queryByTestId('agent-builder-agent-impact-warnings')).toBeNull();
  });

  it('shows the star warning when the agent has been starred by other users', async () => {
    stubAgentDetails({ isStarred: false, starCount: 3 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const starred = await screen.findByTestId('agent-builder-agent-impact-starred-warning');
    expect(starred.textContent).toContain('3 users');
    expect(screen.queryByTestId('agent-builder-agent-impact-dependents-warning')).toBeNull();
  });

  it('singularizes the star warning when only one user has starred the agent', async () => {
    stubAgentDetails({ isStarred: true, starCount: 1 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const starred = await screen.findByTestId('agent-builder-agent-impact-starred-warning');
    expect(starred.textContent).toContain('1 user');
  });

  it('lists dependent agents when other agents use this one as a sub-agent', async () => {
    stubAgentDependents([
      { id: 'parent-1', name: 'Concierge' },
      { id: 'parent-2', name: 'Researcher' },
    ]);

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const warning = await screen.findByTestId('agent-builder-agent-impact-dependents-warning');
    expect(warning.textContent).toContain('2 agents use this agent as a sub-agent');
    expect(warning.textContent).toContain('Concierge');
    expect(warning.textContent).toContain('Researcher');
    expect(screen.queryByTestId('agent-builder-agent-impact-dependents-more')).toBeNull();
  });

  it('truncates the dependents list and shows an overflow count when there are many', async () => {
    stubAgentDependents([
      { id: 'p1', name: 'Agent 1' },
      { id: 'p2', name: 'Agent 2' },
      { id: 'p3', name: 'Agent 3' },
      { id: 'p4', name: 'Agent 4' },
      { id: 'p5', name: 'Agent 5' },
      { id: 'p6', name: 'Agent 6' },
      { id: 'p7', name: 'Agent 7' },
    ]);

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const more = await screen.findByTestId('agent-builder-agent-impact-dependents-more');
    expect(more.textContent).toContain('and 2 more');
    expect(screen.getAllByTestId('agent-builder-agent-impact-dependent')).toHaveLength(5);
  });

  it('surfaces hiddenCount for cross-workspace private dependents', async () => {
    stubAgentDependents([], { hiddenCount: 3 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const hidden = await screen.findByTestId('agent-builder-agent-impact-hidden-warning');
    expect(hidden.textContent).toContain('3 private agents in other workspaces');
    expect(screen.queryByTestId('agent-builder-agent-impact-dependents-warning')).toBeNull();
  });

  it('singularizes the hiddenCount warning when only one private dependent is hidden', async () => {
    stubAgentDependents([], { hiddenCount: 1 });

    render(
      <Wrapper>
        <DeleteAgentPanelButton agentId="agent-123" agentName="My Agent" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-delete-agent'));

    const hidden = await screen.findByTestId('agent-builder-agent-impact-hidden-warning');
    expect(hidden.textContent).toContain('1 private agent in another workspace');
  });

  it('still allows confirming the delete when the dependents lookup fails', async () => {
    let deleteCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123/dependents`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
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
    // No warning block is rendered when the lookup fails — the dialog falls
    // back to the original confirmation copy.
    expect(screen.queryByTestId('agent-builder-agent-impact-warnings')).toBeNull();
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
    await waitFor(() => {
      expect((screen.getByTestId('agent-builder-delete-agent-confirm') as HTMLButtonElement).disabled).toBe(false);
    });
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
    stubAgentDetails();
    stubAgentDependents();
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
