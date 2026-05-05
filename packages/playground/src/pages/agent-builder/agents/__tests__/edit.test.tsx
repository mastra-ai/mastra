// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import type * as MastraReact from '@mastra/react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const saveMock = vi.fn().mockResolvedValue(undefined);

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

let storedAgent: unknown = null;
let currentUser: { id: string } | null | undefined = { id: 'current-user' };
let isCurrentUserLoading = false;

vi.mock('@/domains/agent-builder/hooks/use-save-agent', () => ({
  useSaveAgent: () => ({ save: saveMock, isSaving: false }),
}));

const builderFeatures = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  skills: false,
  avatarUpload: false,
  model: false,
  stars: false,
  browser: false,
};

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => builderFeatures,
}));

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => builderFeatures,
}));

vi.mock('@/domains/agents/hooks/use-stored-skills', () => ({
  useStoredSkills: () => ({ data: { skills: [] }, isPending: false }),
}));

vi.mock('@/domains/agent-builder/hooks/use-available-agent-tools', () => ({
  useAvailableAgentTools: () => [],
}));

vi.mock('@/domains/agent-builder/components/agent-builder-edit/hooks/use-starter-user-message', () => ({
  useStarterUserMessage: () => undefined,
}));

const useStoredAgentMock = vi.fn((..._args: unknown[]) => ({ data: storedAgent, isLoading: false }));
const deleteStoredAgentMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('@/domains/agents/hooks/use-stored-agents', () => ({
  useStoredAgent: (...args: unknown[]) => useStoredAgentMock(...args),
  useStoredAgentMutations: () => ({
    createStoredAgent: { mutateAsync: vi.fn(), isPending: false },
    updateStoredAgent: { mutateAsync: vi.fn(), isPending: false },
    deleteStoredAgent: { mutateAsync: deleteStoredAgentMutateAsync, isPending: false },
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

vi.mock('@/domains/workspace/hooks/use-stored-workspaces', () => ({
  useStoredWorkspaces: () => ({ data: { workspaces: [] } }),
}));

vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => ({ data: { enabled: true }, isLoading: false }),
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: currentUser, isLoading: isCurrentUserLoading }),
}));

// Heavy panels not under test — replace with dumb stubs.
vi.mock('@/domains/agent-builder/components/agent-builder-edit/conversation-panel', () => ({
  ConversationPanel: () => <div data-testid="stub-conversation-panel" />,
  ConversationPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConversationPanelChat: () => <div data-testid="stub-conversation-panel" />,
}));
vi.mock('@/domains/agent-builder/components/agent-builder-edit/stream-chat-provider', () => ({
  StreamChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/domains/agent-builder/components/agent-builder-edit/stream-chat-context', () => ({
  useStreamRunning: () => false,
  useStreamMessages: () => [],
  useStreamSend: () => () => {},
}));
vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => ({ active: false }),
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

vi.mock('@mastra/react', async () => {
  const actual = await vi.importActual<typeof MastraReact>('@mastra/react');
  return {
    ...actual,
    MastraReactProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import AgentBuilderAgentEdit from '../edit';

const renderAt = (path = '/agent-builder/agents/agent-123/edit') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agent-builder/agents/:id/edit" element={<AgentBuilderAgentEdit />} />
          <Route path="/agent-builder/agents/:id/view" element={<div data-testid="view-page" />} />
          <Route path="/agent-builder/agents" element={<div data-testid="agents-list-page" />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );

describe('AgentBuilderAgentEdit', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    saveMock.mockClear();
    useStoredAgentMock.mockClear();
    deleteStoredAgentMutateAsync.mockClear();
    deleteStoredAgentMutateAsync.mockResolvedValue(undefined);
    storedAgent = null;
    currentUser = { id: 'current-user' };
    isCurrentUserLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects to the agents list when no stored agent exists', () => {
    storedAgent = null;
    const { getByTestId } = renderAt();
    expect(getByTestId('agents-list-page')).not.toBeNull();
  });

  describe('edit mode (stored agent present)', () => {
    beforeEach(() => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
      };
    });

    it('does not render Cancel or Save buttons (autosaved)', () => {
      const { queryByTestId } = renderAt();
      expect(queryByTestId('agent-builder-edit-cancel')).toBeNull();
      expect(queryByTestId('agent-builder-edit-save')).toBeNull();
    });

    it('shows the Publish to channel button for the owner when the agent is public', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
        authorId: 'current-user',
        visibility: 'public',
      };
      const { getByTestId } = renderAt();
      const button = getByTestId('agent-builder-publish-channel') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it('hides the Publish to channel button when the agent is private', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
        authorId: 'current-user',
        visibility: 'private',
      };
      const { queryByTestId } = renderAt();
      expect(queryByTestId('agent-builder-publish-channel')).toBeNull();
    });

    it('back arrow navigates to the view page without saving', () => {
      const { getByLabelText } = renderAt();
      fireEvent.click(getByLabelText('Back to agent chat'));

      expect(saveMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/view', { viewTransition: true });
    });

    it('autosaves edits without navigating away', async () => {
      const { getByTestId } = renderAt();
      fireEvent.change(getByTestId('agent-configure-name'), { target: { value: 'Renamed' } });

      await waitFor(() => expect(saveMock).toHaveBeenCalled());
      expect(navigateMock).not.toHaveBeenCalledWith(
        '/agent-builder/agents/agent-123/view',
        expect.anything(),
      );
    });

    it('reads the latest draft so freshly saved edits appear', () => {
      renderAt();
      expect(useStoredAgentMock).toHaveBeenCalledWith(
        'agent-123',
        expect.objectContaining({ status: 'draft' }),
      );
    });

    it('autosaves edits made in the configure panel', async () => {
      const { getByTestId } = renderAt();
      fireEvent.change(getByTestId('agent-configure-name'), { target: { value: 'Updated name' } });
      fireEvent.change(getByTestId('agent-configure-description'), { target: { value: 'Updated description' } });

      await waitFor(() => expect(saveMock).toHaveBeenCalled());
      const lastCall = saveMock.mock.calls[saveMock.mock.calls.length - 1]![0];
      expect(lastCall).toMatchObject({
        name: 'Updated name',
        description: 'Updated description',
      });
    });

    it('waits for the current user before redirecting an owned agent', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
        authorId: 'current-user',
      };
      isCurrentUserLoading = true;
      currentUser = undefined;

      const { queryByTestId } = renderAt();

      expect(queryByTestId('agent-configure-name')).toBeNull();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('renders Chat and Configuration tabs in edit mode', () => {
      const { getByTestId } = renderAt();
      expect(getByTestId('agent-builder-tab-chat')).not.toBeNull();
      expect(getByTestId('agent-builder-tab-configure')).not.toBeNull();
    });

    it('switching to Configuration tab in edit mode toggles active panel', () => {
      const { getByTestId } = renderAt();
      const chatPanel = getByTestId('agent-builder-panel-chat');
      const configureTab = getByTestId('agent-builder-tab-configure');
      expect(chatPanel.getAttribute('data-active-tab')).toBe('chat');
      expect(configureTab.getAttribute('aria-selected')).toBe('false');

      fireEvent.click(configureTab);

      expect(chatPanel.getAttribute('data-active-tab')).toBe('configure');
      expect(configureTab.getAttribute('aria-selected')).toBe('true');
    });

    it('renders the Delete agent button in edit mode and triggers the mutation + redirect on confirm', async () => {
      const { getByTestId } = renderAt();
      const deleteButton = getByTestId('agent-builder-delete-agent');
      fireEvent.click(deleteButton);

      const confirm = getByTestId('agent-builder-delete-agent-confirm');
      fireEvent.click(confirm);

      await waitFor(() => expect(deleteStoredAgentMutateAsync).toHaveBeenCalledTimes(1));
      expect(deleteStoredAgentMutateAsync).toHaveBeenCalledWith(undefined);
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/agent-builder/agents', { viewTransition: true }));
    });

    it('redirects non-owners to the view page after current user loads', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
        authorId: 'another-user',
      };
      currentUser = { id: 'current-user' };

      const { getByTestId } = renderAt();

      expect(getByTestId('view-page')).not.toBeNull();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe('back arrow', () => {
    it('navigates to the view page in edit mode', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
      };
      const { getByLabelText } = renderAt();
      fireEvent.click(getByLabelText('Back to agent chat'));
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/view', { viewTransition: true });
    });
  });
});
