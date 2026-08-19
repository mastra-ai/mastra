import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../components/__tests__/composer-session-test-fixture';
import { ChatMessageBoundary } from '../ChatSessionProvider';
import { ChatSessionTestProvider } from '../ChatSessionTestProvider';

const OTHER_REPOSITORY_ID = 'repo-other';
const SESSION_REPOSITORY_ID = 'repo-session';

function renderSession() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
              <ChatMessageBoundary>
                <div data-testid="chat-content">ready</div>
              </ChatMessageBoundary>
            </ChatSessionTestProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('workspace warm-up repository targeting', () => {
  it('warms the repository from the session metadata, never the factory fallback', async () => {
    stubPreparingSession({ materialized: true });
    const ensuredRepositories: string[] = [];
    let connectionsServed = false;
    // The session row is held open explicitly (not on a timer) so the test
    // deterministically creates — and then closes — the window where the
    // connections list is known but the session row is not. An ungated
    // warm-up fired for repositories[0] inside exactly that window.
    let releaseSession!: () => void;
    const sessionGate = new Promise<void>(resolve => (releaseSession = resolve));

    server.use(
      // Two repositories: the factory's first repository is NOT the one the
      // session belongs to. Before the session row resolves, the provider's
      // `repository` fallback points at the first repository — warm-up must
      // wait for the session metadata instead of using that fallback.
      http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () => {
        connectionsServed = true;
        return HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-1',
              repositories: [
                {
                  id: OTHER_REPOSITORY_ID,
                  branch: 'main',
                  sandboxWorkdir: '/workspace/other',
                  repository: { slug: 'octo/other', defaultBranch: 'main' },
                },
                {
                  id: SESSION_REPOSITORY_ID,
                  branch: 'main',
                  sandboxWorkdir: '/workspace/session',
                  repository: { slug: 'octo/session', defaultBranch: 'main' },
                },
              ],
            },
          ],
        });
      }),
      http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, async () => {
        await sessionGate;
        return HttpResponse.json({
          session: {
            id: 'row-1',
            sessionId: SESSION_ID,
            projectRepositoryId: SESSION_REPOSITORY_ID,
            orgId: 'org-1',
            userId: 'user-1',
            branch: 'user/session-1',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: null,
            materializedAt: '2026-07-23T00:00:00.000Z',
            createdAt: '2026-07-23T00:00:00.000Z',
            updatedAt: '2026-07-23T00:00:00.000Z',
          },
        });
      }),
      http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, ({ params }) => {
        ensuredRepositories.push(String(params.projectRepositoryId));
        return HttpResponse.json({ resourceId: SESSION_ID, sandboxId: null, sandboxWorkdir: '/workspace/session' });
      }),
    );

    const { client } = renderSession();

    // Hold the "connections known, session unknown" window open until the
    // repository list has definitely been served, then release the session.
    await waitFor(() => expect(connectionsServed).toBe(true));
    releaseSession();

    expect(await screen.findByTestId('chat-content')).toBeInTheDocument();
    // The warm-up is a mutation; wait until every mutation has settled — and
    // stays settled across a macrotask gap — so a late warm-up request for
    // the fallback repository cannot escape the assertion below. (Full
    // query-idle is not usable here: the agent-controller connection-init
    // queries in this fixture are long-lived by design.)
    await waitFor(async () => {
      expect(client.isMutating()).toBe(0);
      expect(ensuredRepositories.length).toBeGreaterThan(0);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(client.isMutating()).toBe(0);
    });
    expect(ensuredRepositories).toEqual([SESSION_REPOSITORY_ID]);
  });
});
