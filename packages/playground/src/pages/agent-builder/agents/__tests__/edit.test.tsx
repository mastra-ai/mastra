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

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => ({ tools: false, memory: false, workflows: false, agents: false, skills: false }),
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

vi.mock('@/domains/agents/hooks/use-stored-agents', () => ({
  useStoredAgent: () => ({ data: storedAgent, isLoading: false }),
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

vi.mock('@/domains/workspace/hooks', () => ({
  useWorkspaces: () => ({ data: { workspaces: [] } }),
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
vi.mock('@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel', () => ({
  AgentConfigurePanel: () => <div data-testid="stub-configure-panel" />,
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
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );

describe('AgentBuilderAgentEdit', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    saveMock.mockClear();
    storedAgent = null;
    currentUser = { id: 'current-user' };
    isCurrentUserLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe('create mode (no stored agent)', () => {
    it('renders only the primary Create button (no Cancel)', () => {
      const { queryByTestId, getByTestId } = renderAt();
      expect(getByTestId('agent-builder-edit-save').textContent).toContain('Create');
      expect(queryByTestId('agent-builder-edit-cancel')).toBeNull();
    });

    it('navigates to the view page after a successful save', async () => {
      const { getByTestId } = renderAt();
      fireEvent.click(getByTestId('agent-builder-edit-save'));

      await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/view', { viewTransition: true });
    });
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

    it('renders Cancel + Save in the top right', () => {
      const { getByTestId } = renderAt();
      expect(getByTestId('agent-builder-edit-cancel')).not.toBeNull();
      expect(getByTestId('agent-builder-edit-save').textContent).toContain('Save');
    });

    it('Cancel navigates back to the view page without saving', () => {
      const { getByTestId } = renderAt();
      fireEvent.click(getByTestId('agent-builder-edit-cancel'));

      expect(saveMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/view', { viewTransition: true });
    });

    it('Save navigates to the view page after a successful save', async () => {
      const { getByTestId } = renderAt();
      fireEvent.click(getByTestId('agent-builder-edit-save'));

      await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents/agent-123/view', { viewTransition: true });
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

      expect(queryByTestId('stub-configure-panel')).toBeNull();
      expect(navigateMock).not.toHaveBeenCalled();
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
    it('navigates to the agents list in create mode', () => {
      const { getByLabelText } = renderAt();
      fireEvent.click(getByLabelText('Agents list'));
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents');
    });

    it('navigates to the agents list in edit mode', () => {
      storedAgent = {
        id: 'agent-123',
        name: 'Existing',
        instructions: 'Do things',
        tools: [],
        agents: [],
        workflows: [],
      };
      const { getByLabelText } = renderAt();
      fireEvent.click(getByLabelText('Agents list'));
      expect(navigateMock).toHaveBeenLastCalledWith('/agent-builder/agents');
    });
  });
});
