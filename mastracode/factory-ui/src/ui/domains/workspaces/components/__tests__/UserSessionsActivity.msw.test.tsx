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

import { queryKeys } from '../../../../../api/keys';
import { attentionKindSummaries } from '../../../../../../e2e/ui/attention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import type { FactoryAttentionItem } from '../../../factory/services/attention';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

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

/**
 * A parked run as the attention feed reports it for a card-less user session:
 * aimed at the user threads list, which is the only place this park surfaces.
 */
function parkedOn(sessionId: string, overrides: Partial<FactoryAttentionItem> = {}): FactoryAttentionItem {
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: null,
    title: 'Waiting on you',
    detail: 'Agent is waiting for an answer',
    occurredAt: '2026-07-22T00:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: sessionId, list: 'user' },
    sessionId,
    threadId: sessionId,
    role: 'user',
    toolName: 'ask_user',
    ...overrides,
  } as FactoryAttentionItem;
}

function stubAttention(items: FactoryAttentionItem[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/attention`, () =>
      HttpResponse.json({ items, kinds: attentionKindSummaries(items), hasMore: false }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
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

  it('shows the initializing belt for a session that has not materialized yet', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-2', branch: 'user/feature-b', materializedAt: null })]);
    stubActiveSessions(new Set());

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Initializing feature-b' });
  });

  it('clears the initializing belt once the run that materialized the session finishes', async () => {
    let settled = false;
    const active = new Set(['sess-4']);
    stubProjectAndSessions([]);
    // Serve a mutable session row so the next sessions refetch observes the
    // stamped `materializedAt` (registered after the base stub — the most
    // recent handler wins).
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({
          sessions: [
            makeSession({
              sessionId: 'sess-4',
              branch: 'user/feature-d',
              materializedAt: settled ? '2026-07-20T00:00:00.000Z' : null,
            }),
          ],
        }),
      ),
    );
    stubActiveSessions(active);

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    await screen.findByRole('status', { name: 'Initializing feature-d' });

    // The run finishes and the server stamps materializedAt; the sessions
    // list refetches on its own cadence.
    settled = true;
    active.delete('sess-4');
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await client.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
    await waitForMutationsIdle(client);

    // The belt goes dark on an idle session, not back on (or stuck at) initializing.
    const row = screen.getByRole('button', { name: 'feature-d' }).closest('li');
    await waitFor(() => expect(row?.querySelector('[role="status"]')).toBeNull());
  });

  it('leaves an idle materialized session without a status belt', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-3', branch: 'user/feature-c' })]);
    stubActiveSessions(new Set());

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    const row = (await screen.findByRole('button', { name: 'feature-c' })).closest('li');
    expect(row).not.toBeNull();
    expect(row?.querySelector('[role="status"]')).toBeNull();
  });

  /**
   * A user session's park has no work item to hang off, so the board's parked
   * set never names it. Without the attention feed as the source, these rows
   * would carry no "waiting on you" signal at all.
   */
  it('lights the waiting belt on a parked user session', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-5', branch: 'user/feature-e' })]);
    stubActiveSessions(new Set());
    stubAttention([parkedOn('sess-5')]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'feature-e waiting on you' });
  });

  it('keeps the waiting belt after the park has been read: the answer is still owed', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-6', branch: 'user/feature-f' })]);
    stubActiveSessions(new Set());
    stubAttention([parkedOn('sess-6', { read: true })]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'feature-f waiting on you' });
    // The dot is the read receipt's business, and that one has been read.
    expect(screen.queryByRole('img', { name: 'Unread attention in feature-f' })).toBeNull();
  });

  it('drops the waiting belt once the park is archived', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-7', branch: 'user/feature-g' })]);
    stubActiveSessions(new Set());
    stubAttention([parkedOn('sess-7', { archived: true })]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    const row = (await screen.findByRole('button', { name: 'feature-g' })).closest('li');
    expect(row?.querySelector('[role="status"]')).toBeNull();
  });

  it('lets a live run outrank the park it is resuming from', async () => {
    stubProjectAndSessions([makeSession({ sessionId: 'sess-8', branch: 'user/feature-h' })]);
    stubActiveSessions(new Set(['sess-8']));
    stubAttention([parkedOn('sess-8')]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: 'Agent working in feature-h' });
  });
});
