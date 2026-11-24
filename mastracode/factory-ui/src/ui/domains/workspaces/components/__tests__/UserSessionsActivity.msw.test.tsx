/**
 * Sidebar activity belt for user sessions.
 *
 * User sessions are addressed by their own `sessionId` as `resourceId`, so they
 * read the same active-run registry as factory workspaces. This suite pins down
 * the three-state indicator (initializing / working / idle) for those rows.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { invalidateSessionQueries } from '../../../../../hooks/useWorkspaces';
import { listedRepository } from '../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

function makeSession(
  overrides: Partial<FactoryUserSession> & Pick<FactoryUserSession, 'sessionId' | 'branch'>,
): FactoryUserSession {
  return {
    id: `row-${overrides.sessionId}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org' as const,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-07-20T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function stubProjectAndSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: factoryId,
            name: 'Mastra',
            repositories: [
              listedRepository(projectRepositoryId, 'octo/hello', {
                branch: 'main',
              }),
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
  );
}

function stubActiveSessions(activeIds: Set<string>) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agent-controller/:agentControllerId/active-runs`, () =>
      HttpResponse.json({
        runs: [...activeIds].map(sessionId => ({
          runId: `run-${sessionId}`,
          resourceId: sessionId,
          threadId: sessionId,
        })),
      }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('User sessions sidebar activity', () => {
  it('lights the working belt when the session has an active thread', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-1', branch: 'user/feature-a' })]);
    stubActiveSessions(new Set(['sess-1']));

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Agent working in feature-a' });
  });

  it('shows the initializing belt while a run waits on the session setting up', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-2', branch: 'user/feature-b', materializedAt: null })]);
    stubActiveSessions(new Set(['sess-2']));

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Initializing feature-b' });
  });

  it('clears the initializing belt once the run ends, though setup never finished', async () => {
    const active = new Set(['sess-4']);
    stubProjectAndSessions([makeSession({ sessionId: 'sess-4', branch: 'user/feature-d', materializedAt: null })]);
    stubActiveSessions(active);

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    await screen.findByRole('status', { name: 'Initializing feature-d' });

    active.delete('sess-4');
    await invalidateSessionQueries(client, factoryId);
    await waitForMutationsIdle(client);

    // The belt goes dark on an idle session, not back on (or stuck at) initializing.
    const row = screen.getByRole('link', { name: 'feature-d' }).closest('li');
    await waitFor(() => expect(row?.querySelector('[role="status"]')).toBeNull());
  });

  it('leaves an idle materialized session without a status belt', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-3', branch: 'user/feature-c' })]);
    stubActiveSessions(new Set());

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    const row = (await screen.findByRole('link', { name: 'feature-c' })).closest('li');
    expect(row).not.toBeNull();
    expect(row?.querySelector('[role="status"]')).toBeNull();
  });
});
