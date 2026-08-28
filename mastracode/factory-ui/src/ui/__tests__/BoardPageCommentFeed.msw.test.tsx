import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
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
    bodyFormat: 'markdown',
    body,
    author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
    mentions: [],
    occurredAt: '2026-08-26T10:00:00.000Z',
    revision: 1,
  };
}

function stubBoardEndpoints(board: { commentCount: number; feedActivityAt: string | null }) {
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
            commentCount: board.commentCount,
            feedActivityAt: board.feedActivityAt,
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

function mockMobileViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.restoreAllMocks());

function renderBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Board popover comment feed', () => {
  it('opens straight onto the feed and the composer, without stealing focus', async () => {
    const board = { commentCount: 1, feedActivityAt: '2026-08-26T10:00:00.000Z' };
    let commentRequests = 0;
    stubBoardEndpoints(board);
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello from the feed')] });
      }),
    );
    const user = userEvent.setup();
    renderBoard();

    await screen.findByLabelText('Fix login bug');
    expect(commentRequests).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    expect(await within(dialog).findByText('hello from the feed')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Comment' })).not.toHaveFocus();
  });

  it('shows an empty feed as the composer under a quiet one-line hint', async () => {
    const board = { commentCount: 0, feedActivityAt: null };
    stubBoardEndpoints(board);
    server.use(http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [] })));
    const user = userEvent.setup();
    renderBoard();

    await screen.findByLabelText('Fix login bug');
    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });

    await within(dialog).findByRole('textbox', { name: 'Comment' });
    // The board snapshot already knows the feed is empty: no skeleton first.
    expect(within(dialog).queryByRole('status', { name: 'Loading comments' })).toBeNull();
    expect(within(dialog).getByText('No comments yet')).toBeInTheDocument();
  });

  it('posts from the popover composer and refreshes the row list and the card count', async () => {
    const board = { commentCount: 1, feedActivityAt: '2026-08-26T10:00:00.000Z' };
    const serverComments = [wireComment('c1', 'hello from the feed')];
    stubBoardEndpoints(board);
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [...serverComments] })),
      http.post(COMMENTS_URL, async ({ request }) => {
        const input = (await request.json()) as { clientToken: string };
        serverComments.unshift({ ...wireComment('c2', 'fresh words'), clientToken: input.clientToken });
        board.commentCount = 2;
        board.feedActivityAt = '2026-08-26T10:05:00.000Z';
        return HttpResponse.json({ comment: serverComments[0] }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderBoard();

    await screen.findByLabelText('Fix login bug');
    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    await within(dialog).findByText('hello from the feed');

    await user.click(within(dialog).getByRole('textbox', { name: 'Comment' }));
    await user.keyboard('fresh words');
    await user.click(within(dialog).getByRole('button', { name: 'Send comment' }));

    expect(await within(dialog).findByText('fresh words')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(await screen.findByLabelText('2 comments')).toBeInTheDocument();
  });

  it('gives the phone sheet a thread view of its own, loaded when it is opened', async () => {
    mockMobileViewport();
    const board = { commentCount: 1, feedActivityAt: '2026-08-26T10:00:00.000Z' };
    let commentRequests = 0;
    stubBoardEndpoints(board);
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello from the feed')] });
      }),
    );
    const user = userEvent.setup();
    renderBoard();

    await screen.findByLabelText('Fix login bug');
    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    const sheet = await screen.findByRole('dialog', { name: 'Fix login bug' });

    // The feed is a view, not a section under the description: nothing of it is
    // mounted — and nothing fetched — while the details are on screen.
    expect(within(sheet).queryByRole('textbox', { name: 'Comment' })).toBeNull();
    expect(commentRequests).toBe(0);

    await user.click(within(sheet).getByRole('button', { name: 'Comments · 1' }));

    expect(await within(sheet).findByText('hello from the feed')).toBeInTheDocument();
    expect(within(sheet).getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
  });

  it('stops watching the feed once the details close', async () => {
    const board = { commentCount: 1, feedActivityAt: '2026-08-26T10:00:00.000Z' };
    let commentRequests = 0;
    stubBoardEndpoints(board);
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello from the feed')] });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderBoard();

    await screen.findByLabelText('Fix login bug');
    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    await within(dialog).findByText('hello from the feed');
    await waitForMutationsIdle(client);
    const requestsWhileOpen = commentRequests;

    await user.click(within(dialog).getByRole('button', { name: 'Collapse Fix login bug' }));
    // Activity moves while the popover is closed: the closed feed must not refetch.
    board.feedActivityAt = '2026-08-26T10:10:00.000Z';
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.workItems(FACTORY_ID) });
    });
    await waitForMutationsIdle(client);
    expect(commentRequests).toBe(requestsWhileOpen);
  });
});
