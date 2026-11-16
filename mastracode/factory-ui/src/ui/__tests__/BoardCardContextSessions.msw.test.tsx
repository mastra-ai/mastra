import { screen, waitFor } from '@testing-library/react';
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
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main' })],
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
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

describe('Board card sessions by context', () => {
  it("links the card to the session of the context its current phase runs in, not the card's first session", async () => {
    stubWorkBoard();
    renderWorkBoard();

    const open = await screen.findByRole('link', { name: /Fix login bug$/ });
    await waitFor(() => expect(open).toHaveAttribute('href', threadPath(workSession)));
  });
});
