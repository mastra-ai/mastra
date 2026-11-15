/**
 * A card keeps one session per context it ran in. Clicking it opens the session
 * of the context its current phase runs in, and its details list every session
 * by context, the current one marked.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import type { WorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const triageSession = {
  sessionId: 'triage-session',
  branch: 'factory/issue-1',
  threadId: 'triage-thread',
  startedBy: 'user-1',
};
const workSession = {
  sessionId: 'work-session',
  branch: 'factory/issue-1',
  threadId: 'work-thread',
  startedBy: 'user-1',
};

/** A work item as the server sends it: the client maps the project id and source onto `WorkItem`. */
type WireWorkItem = Omit<WorkItem, 'githubProjectId' | 'source' | 'sourceKey' | 'url'> & {
  factoryProjectId: string;
  externalSource: { integrationId: string; type: string; externalId: string } | null;
};

const buildingCard: WireWorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
  triageType: null,
  acceptedAt: null,
  board: 'work',
  parentWorkItemId: null,
  title: 'Fix login bug',
  stages: ['execute'],
  stageHistory: [
    { stage: 'intake', enteredAt: '2026-07-18T00:00:00.000Z', exitedAt: '2026-07-18T01:00:00.000Z', by: 'user-1' },
    { stage: 'triage', enteredAt: '2026-07-18T01:00:00.000Z', exitedAt: '2026-07-18T02:00:00.000Z', by: 'agent' },
    { stage: 'planning', enteredAt: '2026-07-18T02:00:00.000Z', exitedAt: '2026-07-18T03:00:00.000Z', by: 'agent' },
    { stage: 'execute', enteredAt: '2026-07-18T03:00:00.000Z', by: 'agent' },
  ],
  sessions: { triage: triageSession, work: workSession },
  metadata: {},
  description: null,
  revision: 4,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T03:00:00.000Z',
};

const threadPath = (ref: { sessionId: string; threadId: string }) =>
  `/factories/${FACTORY_ID}/workspaces/${ref.sessionId}/threads/${ref.threadId}`;

function stubWorkBoard() {
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
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () => HttpResponse.json(workBoardCatalog)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [buildingCard] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

describe('Board card sessions by context', () => {
  it("opens the session of the context its current phase runs in, not the card's first session", async () => {
    stubWorkBoard();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    const open = await within(card).findByRole('link', { name: 'Open session' });
    await waitFor(() => expect(open).toHaveAttribute('href', threadPath(workSession)));
  });

  it('lists every session the card holds by context in its details, the current one first', async () => {
    stubWorkBoard();
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));

    const details = await screen.findByRole('dialog', { name: 'Fix login bug' });
    const sessions = await within(details).findByRole('region', { name: 'Sessions' });
    const links = within(sessions).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(['Workcurrent', 'Triage']);
    expect(links[0]).toHaveAttribute('href', threadPath(workSession));
    expect(links[1]).toHaveAttribute('href', threadPath(triageSession));
  });
});
