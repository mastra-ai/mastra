// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
type StoredAgentMock = {
  id: string;
  name: string;
  instructions: string;
  tools: Record<string, unknown> | unknown[];
  agents: Record<string, unknown> | unknown[];
  workflows: Record<string, unknown> | unknown[];
  visibility: string;
  authorId?: string;
};
let storedAgent: StoredAgentMock = {
  id: 'agent-123',
  name: 'My Agent',
  instructions: 'Do things',
  tools: [],
  agents: [],
  workflows: [],
  visibility: 'public',
  authorId: 'current-user',
};

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => ({ tools: false, memory: false, workflows: false, agents: false, skills: false }),
}));

vi.mock('@/domains/agents/hooks/use-stored-skills', () => ({
  useStoredSkills: () => ({ data: { skills: [] }, isPending: false }),
}));

const useAvailableAgentToolsMock = vi.fn((..._args: unknown[]) => [] as unknown[]);
vi.mock('@/domains/agent-builder/hooks/use-available-agent-tools', () => ({
  useAvailableAgentTools: (...args: unknown[]) => useAvailableAgentToolsMock(...args),
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'user-1' }, isLoading: false }),
}));

const useStoredAgentMock = vi.fn((..._args: unknown[]) => ({
  data: storedAgent,
  isLoading: false,
}));
vi.mock('@/domains/agents/hooks/use-stored-agents', () => ({
  useStoredAgent: (...args: unknown[]) => useStoredAgentMock(...args),
  useStoredAgentMutations: () => ({
    createStoredAgent: { mutateAsync: vi.fn(), isPending: false },
    updateStoredAgent: { mutateAsync: vi.fn(), isPending: false },
    deleteStoredAgent: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
  }),
}));

vi.mock('@/domains/tools/hooks/use-all-tools', () => ({
  useTools: () => ({ data: {}, isPending: false }),
}));

vi.mock('@/domains/agents/hooks/use-agents', () => ({
  useAgents: () => ({ data: {}, isPending: false }),
}));

vi.mock('@/domains/workflows/hooks/use-workflows', () => ({
  useWorkflows: () => ({ data: {}, isPending: false }),
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'current-user' } }),
}));

vi.mock('@/domains/agent-builder/components/agent-builder-edit/agent-chat-panel', () => ({
  AgentChatPanel: () => <div data-testid="stub-chat-panel" />,
  AgentChatPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AgentChatPanelChat: () => <div data-testid="stub-chat-panel" />,
}));
vi.mock('@/domains/agent-builder/components/agent-builder-edit/stream-chat-provider', () => ({
  StreamChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/domains/agent-builder/components/agent-builder-edit/stream-chat-context', () => ({
  useStreamRunning: () => false,
  useStreamMessages: () => [],
  useStreamSend: () => () => {},
}));
vi.mock('@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel', () => ({
  AgentConfigurePanel: () => <div data-testid="stub-configure-panel" />,
}));
vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => ({ data: { enabled: true }, isLoading: false }),
}));

vi.mock('@/domains/agent-builder/components/agent-builder-edit/publish-to-channel-button', () => ({
  PublishToChannelButton: ({ agentId }: { agentId: string | undefined }) =>
    agentId ? (
      <button type="button" data-testid="agent-builder-publish-channel" data-agent-id={agentId}>
        Publish to…
      </button>
    ) : null,
}));

vi.mock('@/domains/agent-builder/components/agent-builder-edit/agent-builder-mobile-menu', () => ({
  AgentBuilderMobileMenu: () => null,
}));

import AgentBuilderAgentView from '../view';

const renderAt = (path = '/agent-builder/agents/agent-123/view') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agent-builder/agents/:id/view" element={<AgentBuilderAgentView />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );

describe('AgentBuilderAgentView', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useStoredAgentMock.mockClear();
    useAvailableAgentToolsMock.mockClear();
    storedAgent = {
      id: 'agent-123',
      name: 'My Agent',
      instructions: 'Do things',
      tools: [],
      agents: [],
      workflows: [],
      visibility: 'public',
      authorId: 'current-user',
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an Edit agent icon button for the owner', () => {
    const { getByTestId } = renderAt();
    const button = getByTestId('agent-builder-view-edit');
    expect(button.getAttribute('aria-label')).toBe('Edit agent');
  });

  it('shows the Publish to channel button for the owner', () => {
    const { getByTestId } = renderAt();
    const button = getByTestId('agent-builder-publish-channel') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('hides the Edit and Publish to channel buttons for non-owners', () => {
    storedAgent = { ...storedAgent, authorId: 'someone-else' };
    const { queryByTestId } = renderAt();
    expect(queryByTestId('agent-builder-view-edit')).toBeNull();
    expect(queryByTestId('agent-builder-publish-channel')).toBeNull();
  });

  it('hides the Publish to channel button when the agent is private', () => {
    storedAgent = { ...storedAgent, visibility: 'private' };
    const { queryByTestId } = renderAt();
    expect(queryByTestId('agent-builder-publish-channel')).toBeNull();
  });

  it('shows the current visibility as disabled', () => {
    const { getByTestId } = renderAt();
    const trigger = getByTestId('agent-builder-visibility-trigger');
    expect(trigger.textContent).toContain('Public');
    expect(trigger.hasAttribute('disabled')).toBe(true);
  });

  it('navigates to the edit page when the edit button is clicked', () => {
    const { getByTestId } = renderAt();
    fireEvent.click(getByTestId('agent-builder-view-edit'));
    expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/edit', { viewTransition: true });
  });

  it('reads the latest draft so freshly saved edits appear', () => {
    renderAt();
    expect(useStoredAgentMock).toHaveBeenCalledWith('agent-123', expect.objectContaining({ status: 'draft' }));
  });

  it('re-syncs the form when the stored agent refetches with new data', () => {
    storedAgent = {
      id: 'agent-123',
      name: 'My Agent',
      instructions: 'Do things',
      tools: { 'tool-a': {} },
      agents: [],
      workflows: [],
      authorId: 'current-user',
      visibility: 'public',
    };

    const { rerender } = renderAt();

    const initialSelectedTools = useAvailableAgentToolsMock.mock.calls.at(-1)?.[0] as
      | { selectedTools?: Record<string, boolean> }
      | undefined;
    expect(initialSelectedTools?.selectedTools).toEqual({ 'tool-a': true });

    storedAgent = {
      id: 'agent-123',
      name: 'My Agent',
      instructions: 'Do things',
      tools: { 'tool-b': {} },
      agents: [],
      workflows: [],
      visibility: 'public',
      authorId: 'current-user',
    };

    rerender(
      <TooltipProvider>
        <MemoryRouter initialEntries={['/agent-builder/agents/agent-123/view']}>
          <Routes>
            <Route path="/agent-builder/agents/:id/view" element={<AgentBuilderAgentView />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>,
    );

    const refreshedSelectedTools = useAvailableAgentToolsMock.mock.calls.at(-1)?.[0] as
      | { selectedTools?: Record<string, boolean> }
      | undefined;
    expect(refreshedSelectedTools?.selectedTools).toEqual({ 'tool-b': true });
  });

  it('renders Chat and Configuration tabs for the owner', () => {
    const { getByTestId } = renderAt();
    expect(getByTestId('agent-builder-tab-chat')).not.toBeNull();
    expect(getByTestId('agent-builder-tab-configure')).not.toBeNull();
  });

  it('does not render tabs for non-owners', () => {
    storedAgent = { ...storedAgent, authorId: 'someone-else' };
    const { queryByTestId } = renderAt();
    expect(queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('switching to the Configuration tab toggles which panel is active', () => {
    const { getByTestId } = renderAt();
    const chatPanel = getByTestId('agent-builder-panel-chat');
    const configureTab = getByTestId('agent-builder-tab-configure');
    expect(chatPanel.getAttribute('data-active-tab')).toBe('chat');
    expect(configureTab.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(configureTab);

    expect(chatPanel.getAttribute('data-active-tab')).toBe('configure');
    expect(configureTab.getAttribute('aria-selected')).toBe('true');
  });
});
