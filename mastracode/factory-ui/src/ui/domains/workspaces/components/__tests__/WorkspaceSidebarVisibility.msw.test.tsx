import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const factoryProjectId = 'factory-project-1';
const projectRepositoryId = 'github-project-1';
const resourceId = 'resource-1';
const activeSessionId = 'work-session-1';

function makeSession(index: number, overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  const day = String(20 - index).padStart(2, '0');
  return {
    id: `workspace-row-${index}`,
    sessionId: `work-session-${index}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org' as const,
    branch: `factory/task-${index}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: `2026-07-${day}T00:00:00.000Z`,
    createdAt: `2026-07-${day}T00:00:00.000Z`,
    updatedAt: `2026-07-${day}T00:00:00.000Z`,
    ...overrides,
  };
}

function stubSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${resourceId}/threads`, () =>
      HttpResponse.json({ threads: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryProjectId}/workspaces/${activeSessionId}`]}>
      <ChatSessionContext.Provider
        value={{
          resourceId,
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          sandboxProgress: undefined,
          resourceEnabled: true,
          factorySessionState: { factoryProjectId, projectRepositoryId },
          baseUrl: TEST_BASE_URL,
          kind: 'factory',
        }}
      >
        <Routes>
          <Route path="/factories/:factoryId/workspaces/:sessionId" element={<WorkspacesSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Workspace sidebar visibility', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
  });

  it('keeps a session that has not materialized yet visible past the five-row cut', async () => {
    const sessions = [1, 2, 3, 4, 5].map(index => makeSession(index));
    stubSessions([...sessions, makeSession(6, { materializedAt: null })]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('button', { name: 'factory/task-6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show 1 more' })).toBeInTheDocument();
  });

  it('never drops a pinned session to make room for a busy one', async () => {
    const busy = [1, 2, 3, 4, 6].map(index => makeSession(index, { materializedAt: null }));
    stubSessions([...busy, makeSession(5)]);
    localStorage.setItem('mastracode.pinnedSessions', JSON.stringify(['work-session-5']));

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('button', { name: 'factory/task-5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'factory/task-6' })).not.toBeInTheDocument();
  });
});
