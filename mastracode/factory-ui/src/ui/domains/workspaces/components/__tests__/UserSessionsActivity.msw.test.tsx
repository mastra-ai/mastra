/**
 * Sidebar activity dot for user sessions.
 *
 * User sessions are addressed by their own `sessionId` as `resourceId`, so they
 * read the same active-run registry as factory workspaces. This suite pins down
 * the three-state indicator (initializing / working / idle) for those rows.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import type { FactoryUserSession } from '../../services/github';
import { UserSessionsSection } from '../UserSessionsSection';
import { WorkspaceAttentionObserver } from '../WorkspaceAttentionObserver';

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
      HttpResponse.json({ projects: [{ id: factoryId, name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
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
      <Routes>
        <Route
          path="/factories/:factoryId"
          element={
            <>
              <WorkspaceAttentionObserver projectRepositoryId={projectRepositoryId} />
              <UserSessionsSection />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('User sessions sidebar activity', () => {
  it('lights the working dot when the session has an active thread', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-1', branch: 'user/feature-a' })]);
    stubActiveSessions(new Set(['sess-1']));

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Agent working in feature-a' });
  });

  it('shows the initializing dot for a session that has not materialized yet', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-2', branch: 'user/feature-b', materializedAt: null })]);
    stubActiveSessions(new Set());

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Initializing feature-b' });
  });

  it('resolves the initializing dot once the run that materialized the session finishes', async () => {
    let materialized = false;
    const active = new Set(['sess-4']);
    stubProjectAndSessions([]);
    // Serve a mutable session row so the refetch after run end observes the
    // freshly stamped `materializedAt` (registered after the base stub — the
    // most recent handler wins).
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({
          sessions: [
            makeSession({
              sessionId: 'sess-4',
              branch: 'user/feature-d',
              materializedAt: materialized ? '2026-07-20T00:00:00.000Z' : null,
            }),
          ],
        }),
      ),
    );
    stubActiveSessions(active);

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    await screen.findByRole('status', { name: 'Agent working in feature-d' });

    // The run finishes and the server stamps materializedAt. Force the next
    // activity poll instead of waiting out the real 5s interval.
    materialized = true;
    active.delete('sess-4');
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);

    // Run end must refetch the sessions list: the dot lands on solid attention,
    // not back on (or stuck at) initializing.
    await screen.findByRole('status', { name: 'feature-d ready — open to dismiss' });
    expect(screen.queryByRole('status', { name: 'Initializing feature-d' })).not.toBeInTheDocument();
  });

  it('leaves an idle materialized session without a status dot', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-3', branch: 'user/feature-c' })]);
    stubActiveSessions(new Set());

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    const row = (await screen.findByRole('button', { name: 'feature-c' })).closest('li');
    expect(row).not.toBeNull();
    expect(row?.querySelector('[role="status"]')).toBeNull();
  });
});
