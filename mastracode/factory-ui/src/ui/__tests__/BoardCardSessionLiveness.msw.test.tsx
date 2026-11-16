import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createQueryClient } from '../../query-client';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const SESSION_ID = 'session-1';

const boundSession = {
  id: 'session-row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: '/repo',
  materializedAt: '2026-07-18T00:00:00.000Z',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const workItemSessions: Record<string, { sessionId: string; branch: string; threadId: string; startedBy: string }> = {
  chat: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: SESSION_ID, startedBy: 'user-1' },
};

const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: FACTORY_ID,
  source: 'github-issue',
  sourceKey: 'github-issue:1',
  parentWorkItemId: null,
  title: 'Fix login bug',
  url: null,
  stages: ['triage'],
  stageHistory: [],
  sessions: workItemSessions,
  metadata: {},
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

function stubFactoryWithBoundSession() {
  let sessions = [boundSession];
  let items = [{ ...workItem, sessions: { ...workItemSessions } }];
  const deleted: string[] = [];
  const refetchGate = deferred();

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: items }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, async () => {
      if (deleted.length > 0) await refetchGate.promise;
      return HttpResponse.json({ sessions });
    }),
    http.delete(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      deleted.push(String(params.sessionId));
      sessions = sessions.filter(session => session.sessionId !== params.sessionId);
      items = items.map(item => ({
        ...item,
        sessions: Object.fromEntries(
          Object.entries(item.sessions).filter(([, ref]) => ref.sessionId !== params.sessionId),
        ),
      }));
      return HttpResponse.json({ removed: true });
    }),
  );

  return { deleted, refetchGate };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

describe('Board card session liveness', () => {
  it('advertises a bound session the workspaces list does not know about', async () => {
    stubFactoryWithBoundSession();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
        HttpResponse.json({ sessions: [] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    expect(await within(card).findByText('Session')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Fix login bug$/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`,
    );
    expect(card.querySelector('[data-live-session-indicator]')).toBeNull();
  });

  it('shows the initializing dot while a bound session is still materializing', async () => {
    stubFactoryWithBoundSession();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
        HttpResponse.json({ sessions: [{ ...boundSession, materializedAt: null }] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="initializing"]')).not.toBeNull());
  });

  it('lights the working dot when any bound session runs, not just the newest ref', async () => {
    stubFactoryWithBoundSession();
    const reviewSession = {
      sessionId: 'session-2',
      branch: 'factory/issue-1',
      threadId: 'session-2',
      startedBy: 'user-1',
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [{ ...workItem, sessions: { ...workItemSessions, review: reviewSession } }],
        }),
      ),
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID }] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="working"]')).not.toBeNull());
  });

  it('hides Retry while the bound session is working, even for a retryable failure', async () => {
    stubFactoryWithBoundSession();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
        HttpResponse.json({
          decisions: [
            {
              id: 'decision-1',
              evaluationId: 'evaluation-1',
              workItemId: ITEM_ID,
              type: 'invokeSkill',
              status: 'failed',
              attempts: 5,
              failureOccurrence: 1,
              source: null,
              failureCode: 'repository_clone_failed',
              canRetry: true,
              lastError: 'Command failed with ENOENT',
              createdAt: '2026-07-18T00:00:00.000Z',
              updatedAt: '2026-07-18T00:01:00.000Z',
              completedAt: null,
            },
          ],
        }),
      ),
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID }] }),
      ),
    );
    const { client } = renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="working"]')).not.toBeNull());
    await waitForMutationsIdle(client);
    expect(within(card).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('walks idle → working → idle as a run starts and finishes', async () => {
    stubFactoryWithBoundSession();
    const active = new Set<string>();
    server.use(
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({
          runs: [...active].map(resourceId => ({ runId: `run-${resourceId}`, resourceId, threadId: resourceId })),
        }),
      ),
    );
    const { client } = renderWorkBoard();
    const activityKey = queryKeys.sessionActivity(FACTORY_ID);

    const card = await screen.findByTestId('work-item-card');
    expect(await within(card).findByText('Session')).toBeInTheDocument();
    expect(card.querySelector('[data-live-session-indicator]')).toBeNull();

    active.add(SESSION_ID);
    await client.invalidateQueries({ queryKey: activityKey });
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="working"]')).not.toBeNull());
    expect(within(card).getByText('Session')).toBeInTheDocument();

    active.delete(SESSION_ID);
    await client.invalidateQueries({ queryKey: activityKey });
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator]')).toBeNull());
    expect(within(card).getByText('Session')).toBeInTheDocument();
  });

  it('drops the session mark as soon as its session is deleted from the sidebar', async () => {
    const { deleted, refetchGate } = stubFactoryWithBoundSession();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    expect(await within(card).findByText('Session')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Session actions for factory/issue-1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toEqual([SESSION_ID]));

    await waitFor(() => expect(within(card).queryByText('Session')).toBeNull());
    expect(within(card).getByRole('link', { name: /Fix login bug$/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/cards/${ITEM_ID}`,
    );

    refetchGate.resolve();
    await waitFor(() => expect(within(card).queryByText('Session')).toBeNull());
  });
});
