/**
 * With automatic runs off, the run a rule wanted to start waits on its card.
 * Clicking the card must release that exact proposal — not start a rival run
 * beside it — and the card menu must let someone turn it down instead.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const DECISION_ID = 'decision-1';

// Wire shape as served by /web/factory/*/work-items: the client derives
// `source`/`url` from `externalSource` (see fromWireWorkItem).
const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:1',
    url: 'https://github.com/acme/app/issues/1',
  },
  parentWorkItemId: null,
  title: 'Fix login bug',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 1 },
  revision: 1,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

function decision(status: 'proposed' | 'pending' | 'dismissed') {
  return {
    id: DECISION_ID,
    evaluationId: 'evaluation-1',
    workItemId: ITEM_ID,
    type: 'invokeSkill',
    role: 'plan',
    status,
    attempts: 0,
    lastError: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    completedAt: null,
  };
}

const SESSION_ID = 'sess-1';

const liveSessionWorkItem = {
  ...workItem,
  stages: ['planning'],
  sessions: {
    triage: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: 'thread-1', startedBy: 'user-1' },
  },
};

const userSession = {
  id: 'us-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  title: 'Fix login bug',
  branch: 'factory/issue-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

/**
 * An approved plan transitions the card to Building and writes the `work`
 * session ref itself — no run ever started, but the slot looks used.
 */
const buildingWorkItem = {
  ...workItem,
  stages: ['execute'],
  sessions: {
    triage: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: 'thread-1', startedBy: 'user-1' },
    work: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: 'thread-1', startedBy: 'user-1' },
  },
};

/** A Review card whose pull request has since closed: its parked run is moot. */
const closedPullRequestWorkItem = {
  ...workItem,
  externalSource: { ...workItem.externalSource, type: 'pull-request', externalId: 'github-pr:1' },
  stages: ['review'],
  metadata: { number: 1, state: 'closed' },
};

function stubBoardEndpoints({
  withLiveSession = false,
  building = false,
  closedPullRequest = false,
}: { withLiveSession?: boolean; building?: boolean; closedPullRequest?: boolean } = {}) {
  const settled: string[] = [];
  const startRequests: unknown[] = [];
  let status: 'proposed' | 'pending' | 'dismissed' = 'proposed';
  const item = closedPullRequest
    ? closedPullRequestWorkItem
    : building
      ? buildingWorkItem
      : withLiveSession
        ? liveSessionWorkItem
        : workItem;
  const sessions = withLiveSession || building ? [userSession] : [];

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false }] }),
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
      HttpResponse.json({ workItems: [item] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: building || closedPullRequest ? [] : [decision(status)] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () =>
      HttpResponse.json({ error: 'Metrics unavailable in this scenario' }, { status: 500 }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ session: userSession }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/${DECISION_ID}/approve`, () => {
      settled.push('approve');
      status = 'pending';
      return HttpResponse.json({ decision: decision('pending') });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/${DECISION_ID}/dismiss`, () => {
      settled.push('dismiss');
      status = 'dismissed';
      return HttpResponse.json({ decision: decision('dismissed') });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      startRequests.push(await request.json());
      return HttpResponse.json({
        prepared: {
          workItemId: ITEM_ID,
          bindingId: 'binding-1',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          sessionId: SESSION_ID,
          branch: 'factory/issue-1',
          revision: 2,
          kickoffStatus: 'queued',
          replayed: false,
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['acme/app'] },
          linear: { enabled: false, sourceIds: null },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );

  return { settled, startRequests };
}

function renderBoard(board: 'work' | 'review' = 'work', initialEntry = `/factories/${FACTORY_ID}/${board}`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  return renderWithProviders(<RouterProvider router={router} />);
}

function renderWorkBoard() {
  return renderBoard('work');
}

describe('Board card with a proposed run', () => {
  it('highlights and focuses a work item opened from attention', async () => {
    stubBoardEndpoints();
    const { client } = renderBoard('work', `/factories/${FACTORY_ID}/work?item=${ITEM_ID}`);

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await waitForMutationsIdle(client);
    expect(card).toHaveAttribute('data-highlighted', 'true');
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Details for Fix login bug' })).toHaveFocus());
  });

  it('keeps a targeted Linear intake card visible while GitHub is selected', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...workItem,
              stages: ['intake'],
              externalSource: {
                integrationId: 'linear',
                type: 'issue',
                externalId: 'linear-issue:ENG-1',
                url: 'https://linear.app/acme/issue/ENG-1',
              },
              metadata: { identifier: 'ENG-1' },
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            linear: { enabled: true, sourceIds: ['linear-project'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, workspace: { id: 'workspace-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues: [], nextCursor: null })),
    );
    const { client } = renderBoard('work', `/factories/${FACTORY_ID}/work?item=${ITEM_ID}`);

    expect(await screen.findByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true');
    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await waitForMutationsIdle(client);
    expect(card).toHaveAttribute('data-highlighted', 'true');
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Details for Fix login bug' })).toHaveFocus());
  });

  it('summarizes proposed runs as one approval queue', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
        HttpResponse.json({
          items: [],
          openCount: 1,
          approvalCount: 1,
          badgeCount: 1,
          unreadCount: 0,
          hasMore: false,
          latestOccurrenceKey: null,
          latestOccurrenceAt: null,
          latestOccurrenceUnread: false,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Needs attention, 1 waiting for approval, 1 open' }));
    expect(await screen.findByText('waiting for approval')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View all attention' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/attention`,
    );
  });

  it('releases the proposal instead of starting a second run from the card details', async () => {
    const { settled, startRequests } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    await user.click(within(dialog).getByRole('button', { name: 'Start suggested run: Investigate' }));

    await waitFor(() => expect(settled).toEqual(['approve']));
    expect(startRequests).toHaveLength(0);
  });

  it('turns the proposal down from the card menu', async () => {
    const { settled, startRequests } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await user.click(within(card).getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dismiss suggested run' }));

    await waitFor(() => expect(settled).toEqual(['dismiss']));
    expect(startRequests).toHaveLength(0);
  });

  it('releases the proposal from the menu when the card already links to a session', async () => {
    const { settled, startRequests } = stubBoardEndpoints({ withLiveSession: true });
    const user = userEvent.setup();
    renderWorkBoard();

    // The menu stays reachable on a card with a live session, so a parked run never needs the details to be released.
    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await user.click(within(card).getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Start suggested run' }));

    await waitFor(() => expect(settled).toEqual(['approve']));
    expect(startRequests).toHaveLength(0);
  });

  it('says a run is waiting on a card that would otherwise look idle', async () => {
    const { settled, startRequests } = stubBoardEndpoints({ withLiveSession: true });
    const user = userEvent.setup();
    renderWorkBoard();

    // Without the badge this card reads as a plain link to its session, so the
    // parked run is only discoverable by opening the menu on a hunch.
    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    expect(await within(card).findByText('Suggested: Build')).toBeVisible();
    const release = within(card).getByRole('button', { name: 'Start suggested run: Build' });
    expect(release).toHaveAttribute('data-variant', 'primary');
    expect(within(card).getByRole('link', { name: 'Open session' })).toHaveAttribute('data-variant', 'outline');

    await user.click(release);

    await waitFor(() => expect(settled).toEqual(['approve']));
    expect(startRequests).toHaveLength(0);
  });

  it('stops asking about a run parked on a pull request that already closed', async () => {
    const { settled } = stubBoardEndpoints({ closedPullRequest: true });
    const user = userEvent.setup();
    renderBoard('review');

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    expect(within(card).queryByText(/^Suggested:/)).toBeNull();

    await user.click(within(card).getByRole('button', { name: 'Actions for Fix login bug' }));
    expect(screen.queryByRole('menuitem', { name: 'Dismiss suggested run' })).not.toBeInTheDocument();
    expect(settled).toEqual([]);
  });

  it('still offers the Building run when the plan already filled the work session slot', async () => {
    const { startRequests } = stubBoardEndpoints({ building: true });
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await user.click(within(card).getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(startRequests).toHaveLength(1));
  });
});
