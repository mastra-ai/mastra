import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { WorkItemComment } from '../domains/factory/services/commentsWire';
import { createAppRoutes } from '../router';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;

function wireComment(id: string, body: string): WorkItemComment {
  return {
    id,
    workItemId: ITEM_ID,
    kind: 'comment',
    body,
    author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
    mentions: [],
    occurredAt: '2026-08-26T10:00:00.000Z',
    revision: 1,
    editedAt: null,
    deletedAt: null,
  };
}

function stubBoardEndpoints() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          {
            id: ITEM_ID,
            orgId: 'org-1',
            createdBy: 'user-1',
            factoryProjectId: FACTORY_ID,
            externalSource: null,
            parentWorkItemId: null,
            title: 'Fix login bug',
            stages: ['triage'],
            stageHistory: [],
            sessions: {},
            metadata: {},
            commentCount: 1,
            feedActivityAt: '2026-08-26T10:00:00.000Z',
            revision: 1,
            createdAt: '2026-07-18T00:00:00.000Z',
            updatedAt: '2026-07-18T00:00:00.000Z',
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderBoard(search: string) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Board comment deep link', () => {
  it('opens the linked card details on its own and shows the target comment', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [wireComment('c1', 'the mentioned words')] })),
    );
    renderBoard(`?item=${ITEM_ID}&comment=c1`);

    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    expect(await within(dialog).findByText('the mentioned words')).toBeInTheDocument();
  });

  it('auto-loads at most three earlier pages hunting the comment, then settles with the item open', async () => {
    stubBoardEndpoints();
    let commentRequests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        const page = commentRequests;
        return HttpResponse.json({
          comments: [wireComment(`c-page-${page}`, `page ${page} words`)],
          nextCursor: `cursor-${page}`,
        });
      }),
    );
    renderBoard(`?item=${ITEM_ID}&comment=c-nowhere`);

    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    // Initial page + three deep-link loads, then it gives up quietly.
    await waitFor(() => expect(commentRequests).toBe(4));
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(commentRequests).toBe(4);
    expect(within(dialog).getByText('page 1 words')).toBeInTheDocument();
  });

  it('clears both deep-link params when a board filter changes', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [wireComment('c1', 'the mentioned words')] })),
    );
    const user = userEvent.setup();
    const { router } = renderBoard(`?item=${ITEM_ID}&comment=c1`);

    await screen.findByRole('dialog', { name: 'Fix login bug' });
    const filters = within(screen.getByLabelText('Board filters'));
    await user.type(filters.getByRole('textbox', { name: 'Search cards' }), 'login');

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('item')).toBeNull();
      expect(params.get('comment')).toBeNull();
      expect(params.get('q')).toBe('login');
    });
  });
});
