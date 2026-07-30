/**
 * BDD coverage for `EmptyThreadState`. Factory runs are kicked off
 * server-side: after the board navigates to the thread, the sandbox is still
 * materializing and the dispatcher has not delivered the kickoff yet. The
 * empty state must show an honest preparing panel for factory sessions
 * (workspace → agent progression) instead of the personal-session hero,
 * which implies the user should type something.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatCommandsProvider } from '../../context/ChatCommandsProvider';
import { ChatModelsContext } from '../../context/ChatModelsContext';
import { ChatModesContext } from '../../context/ChatModesContext';
import { ChatPermissionsContext } from '../../context/ChatPermissionsContext';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../context/ChatTranscriptContext';
import { initialTranscript } from '../../services/transcript';
import { EmptyThreadState } from '../EmptyThreadState';

const FACTORY_ID = 'factory-1';

function stubFactoryProjects() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Mastra OSS' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'install-1',
            repositories: [
              {
                id: 'repo-link-1',
                branch: 'factory/pr-123',
                sandboxWorkdir: '/workspaces/mastra',
                repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
  );
}

function sessionValue(kind: 'factory' | 'user'): ChatSessionContextApi {
  return {
    resourceId: 'session-1',
    sessionEnabled: true,
    resourceEnabled: true,
    baseUrl: TEST_BASE_URL,
    kind,
    ...(kind === 'factory'
      ? { factorySessionState: { factoryProjectId: FACTORY_ID, projectRepositoryId: 'repo-link-1' } }
      : {}),
  };
}

function transcriptValue(workspaceReady: boolean | undefined): ChatTranscriptApi {
  return {
    transcript: { ...initialTranscript, ...(workspaceReady === undefined ? {} : { workspaceReady }) },
    busy: false,
    showWorkingIndicator: false,
    localUser: () => {},
    reset: () => {},
    resolvePrompt: () => {},
    clearPending: () => {},
    pushNotice: () => {},
    loadMore: { hasMore: false, isLoading: false },
  };
}

async function renderEmptyState({ kind, workspaceReady }: { kind: 'factory' | 'user'; workspaceReady?: boolean }) {
  stubFactoryProjects();
  const rendered = renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/threads/thread-1`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <ChatSessionContext.Provider value={sessionValue(kind)}>
              <ChatTranscriptContext.Provider value={transcriptValue(workspaceReady)}>
                <ChatModesContext.Provider
                  value={{ modes: [], activeMode: undefined, activeModeId: undefined, setMode: async () => {} }}
                >
                  <ChatModelsContext.Provider value={{ activeModelId: undefined, setModel: async () => {} }}>
                    <ChatPermissionsContext.Provider
                      value={{
                        permissions: undefined,
                        permissionsLoading: false,
                        pendingPermissionCategory: null,
                        setPermissionForCategory: async () => {},
                      }}
                    >
                      <ChatCommandsProvider>
                        <EmptyThreadState />
                      </ChatCommandsProvider>
                    </ChatPermissionsContext.Provider>
                  </ChatModelsContext.Provider>
                </ChatModesContext.Provider>
              </ChatTranscriptContext.Provider>
            </ChatSessionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  await waitForMutationsIdle(rendered.client);
  return rendered;
}

describe('EmptyThreadState', () => {
  describe('when a factory thread is empty and the workspace is not ready yet', () => {
    it('shows the preparing-workspace panel instead of the personal hero', async () => {
      await renderEmptyState({ kind: 'factory' });

      expect(await screen.findByRole('heading', { name: 'Preparing workspace…' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/Provisioning the sandbox/);
      expect(screen.queryByRole('heading', { name: 'What can I help you build?' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Explore this codebase' })).not.toBeInTheDocument();
    });
  });

  describe('when the workspace is ready but the kickoff has not streamed yet', () => {
    it('advances the panel to the starting-agent phase', async () => {
      await renderEmptyState({ kind: 'factory', workspaceReady: true });

      expect(await screen.findByRole('heading', { name: 'Starting the agent…' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/waiting for the first message/);
    });
  });

  describe('when the empty thread belongs to a personal session', () => {
    it('keeps the build hero with suggested prompts', async () => {
      await renderEmptyState({ kind: 'user' });

      expect(await screen.findByRole('heading', { name: 'What can I help you build?' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Explore this codebase' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Preparing workspace…' })).not.toBeInTheDocument();
    });
  });
});
