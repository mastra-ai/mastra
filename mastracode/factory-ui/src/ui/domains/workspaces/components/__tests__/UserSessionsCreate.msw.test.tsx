import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

const projectRepositoryId = 'ghp-1';
const sessionId = '00000000-0000-4000-8000-000000000001';

function userSession(overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org' as const,
    branch: 'user/session-1',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

function stubFactoryWithRepository(sessions: FactoryUserSession[] = []) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-7',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace/hello',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      const session = sessions.find(candidate => candidate.sessionId === params.sessionId);
      return session
        ? HttpResponse.json({ session })
        : HttpResponse.json({ message: 'Session not found' }, { status: 404 });
    }),
  );
}

function trackControllerRequests() {
  const calls = { createSession: 0, renameThread: 0 };
  server.use(
    http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, () => {
      calls.createSession += 1;
      return HttpResponse.json({ controllerId: 'code', resourceId: sessionId, threadId: sessionId });
    }),
    http.put(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/threads/:threadId`, () => {
      calls.renameThread += 1;
      return HttpResponse.json({});
    }),
  );
  return calls;
}

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
        <Route path="/factories/:factoryId/user/new/:draftSessionId" element={<UserSessionsSection />} />
        <Route path="/factories/:factoryId/user/threads/:threadId" element={<UserSessionsSection />} />
        <Route path="*" element={<UserSessionsSection />} />
      </Routes>
      <LocationProbe />
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

describe('User sessions creation', () => {
  it('opens a stable client draft without creating an abandoned session', async () => {
    const sessions: FactoryUserSession[] = [];
    stubFactoryWithRepository(sessions);
    const controller = trackControllerRequests();
    let sessionPosts = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () => {
        sessionPosts += 1;
        return HttpResponse.json({ session: userSession() });
      }),
    );
    const user = userEvent.setup();

    const { client } = renderSection();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New user session' }));

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(
        /^\/factories\/fp-1\/user\/new\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );
    // The session only exists once the first prompt creates it, so the sidebar
    // has nothing to list yet.
    expect(screen.queryByRole('button', { name: 'New session' })).not.toBeInTheDocument();
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(sessionPosts).toBe(0);
    expect(controller).toEqual({ createSession: 0, renameThread: 0 });
    expect(sessions).toEqual([]);
    expect(client.getQueryData(queryKeys.sessions(projectRepositoryId))).toEqual({
      workspaces: [],
      userSessions: [],
    });
  });

  it('prefers titles, preserves legacy labels, and hides automatic UUID branches', async () => {
    const opaqueSessionId = '10000000-0000-4000-8000-000000000002';
    stubFactoryWithRepository([
      userSession({ title: 'Fix login', branch: `user/session-${sessionId}` }),
      userSession({
        id: 'row-2',
        sessionId: 'legacy-id',
        branch: 'user/feature-readable',
      }),
      userSession({
        id: 'row-3',
        sessionId: opaqueSessionId,
        branch: `user/session-${opaqueSessionId}`,
      }),
    ]);

    renderSection();

    expect(await screen.findByRole('button', { name: 'Fix login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'feature-readable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New session' })).toBeInTheDocument();
    expect(screen.queryByText(opaqueSessionId)).not.toBeInTheDocument();
  });

  it('says the session list failed instead of claiming there are none', async () => {
    stubFactoryWithRepository();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ message: 'Nope' }, { status: 500 }),
      ),
    );

    renderSection();

    expect(await screen.findByText('Couldn’t load sessions')).toBeInTheDocument();
    expect(screen.queryByText('No sessions yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New user session' })).toBeEnabled();
  });

  it('deletes the session row and leaves its controller thread in place', async () => {
    const sessions = [userSession()];
    stubFactoryWithRepository(sessions);
    let controllerDeletes = 0;
    let deletedSessions = 0;
    server.use(
      http.delete(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${sessionId}/threads/${sessionId}`, () => {
        controllerDeletes += 1;
        return HttpResponse.json({});
      }),
      http.delete(`${TEST_BASE_URL}/web/user-sessions/${sessionId}`, () => {
        deletedSessions += 1;
        sessions.splice(0);
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderSection();
    client.setQueryData(queryKeys.userSession(sessionId), userSession());

    await user.click(await screen.findByRole('button', { name: 'Session actions for session-1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitForMutationsIdle(client);

    expect(controllerDeletes).toBe(0);
    expect(deletedSessions).toBe(1);
    expect(client.getQueryData(queryKeys.userSession(sessionId))).toBeUndefined();
    expect(await screen.findByText('Session deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'session-1' })).not.toBeInTheDocument();
  });

  it('surfaces a failed delete and keeps the session listed', async () => {
    const sessions = [userSession()];
    stubFactoryWithRepository(sessions);
    server.use(
      http.delete(`${TEST_BASE_URL}/web/user-sessions/${sessionId}`, () =>
        HttpResponse.json({ message: 'Delete failed' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderSection();

    await user.click(await screen.findByRole('button', { name: 'Session actions for session-1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitForMutationsIdle(client);

    expect(await screen.findByText(/Failed to delete session \(500\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'session-1' })).toBeInTheDocument();
  });
});
