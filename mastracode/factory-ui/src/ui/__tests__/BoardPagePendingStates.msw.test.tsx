/**
 * Stage moves are multi-second server evaluations. While one is in flight the
 * card must announce where it is going ("Moving to Planning…") instead of
 * silently waiting, and drop the status once the server answers.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { GithubIssue } from '../domains/factory/services/factory';
import type { LinearIssue } from '../domains/factory/services/linear';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const SESSION_ID = 'session-1';
const THREAD_ID = 'thread-1';

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
  sessions: {
    chat: {
      sessionId: SESSION_ID,
      branch: 'fix-login',
      threadId: THREAD_ID,
      startedBy: 'user-1',
    },
  },
  metadata: {},
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const relatedPullRequest = {
  ...workItem,
  id: 'review-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: 'github-pr:21565',
    url: 'https://github.com/acme/app/pull/21565',
  },
  parentWorkItemId: ITEM_ID,
  title: 'Review login fix',
  stages: ['review'],
  sessions: {},
  metadata: { number: 21565, state: 'open' },
};

const manualWorkItem = {
  id: 'manual-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: null,
  parentWorkItemId: null,
  title: 'Plan onboarding',
  stages: ['intake'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  revision: 1,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function createDataTransfer() {
  const values = new Map<string, string>();
  const types: string[] = [];
  return {
    types,
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    setData(type: string, value: string) {
      values.set(type, value);
      if (!types.includes(type)) types.push(type);
    },
    getData(type: string) {
      return values.get(type) ?? '';
    },
  };
}

/** Stubs the Work board's data endpoints with one triage item and a gated transition. */
function stubBoardEndpoints() {
  const transitionGate = deferred();
  const transitionRequests: string[] = [];

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
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${ITEM_ID}/transition`, async () => {
      transitionRequests.push(ITEM_ID);
      await transitionGate.promise;
      return HttpResponse.json({
        result: {
          status: 'accepted',
          transitionId: 'transition-1',
          itemId: ITEM_ID,
          revision: 2,
          stage: 'planning',
          decisions: [],
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
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({
        sessions: [
          {
            id: 'session-row-1',
            sessionId: SESSION_ID,
            projectRepositoryId: REPO_ID,
            orgId: 'org-1',
            userId: 'user-1',
            branch: 'fix-login',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: '/repo',
            materializedAt: '2026-07-18T00:00:00.000Z',
            createdAt: '2026-07-18T00:00:00.000Z',
            updatedAt: '2026-07-18T00:00:00.000Z',
          },
        ],
      }),
    ),
  );

  return { transitionGate, transitionRequests };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return { ...renderWithProviders(<RouterProvider router={router} />), router };
}

describe('Board card pending states', () => {
  it('shows only Linear candidates after switching Work intake from Issues to Linear', async () => {
    const githubIssue: GithubIssue = {
      number: 42,
      title: 'Investigate GitHub intake failure',
      url: 'https://github.com/acme/app/issues/42',
      author: 'octocat',
      labels: ['status: auto-triaged'],
      comments: 0,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };
    const linearIssue: LinearIssue = {
      id: 'linear-issue-1',
      identifier: 'ENG-42',
      title: 'Fix Linear intake sync',
      url: 'https://linear.app/acme/issue/ENG-42',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'ada',
      team: 'ENG',
      labels: ['bug'],
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const githubWorkItem = {
      ...manualWorkItem,
      id: 'github-intake-item',
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github-issue:99',
        url: 'https://github.com/acme/app/issues/99',
      },
      title: 'Persisted GitHub intake item',
    };
    const linearWorkItem = {
      ...manualWorkItem,
      id: 'linear-intake-item',
      externalSource: {
        integrationId: 'linear',
        type: 'issue',
        externalId: 'linear-issue:ENG-99',
        url: 'https://linear.app/acme/issue/ENG-99',
      },
      title: 'Persisted Linear intake item',
    };

    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [githubWorkItem, linearWorkItem, manualWorkItem] }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            linear: { enabled: true, sourceIds: ['linear-project-1'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.has('label') ? [githubIssue] : [],
          nextPage: null,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json({ issues: [linearIssue], nextCursor: null }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderWorkBoard();

    await waitForMutationsIdle(client);
    expect(screen.getByText('Investigate GitHub intake failure')).toBeVisible();
    expect(screen.getByText('Persisted GitHub intake item')).toBeVisible();
    expect(screen.queryByText('Persisted Linear intake item')).not.toBeInTheDocument();
    expect(screen.getByText('Plan onboarding')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Linear' }));

    await waitForMutationsIdle(client);
    expect(screen.getByText('Fix Linear intake sync')).toBeVisible();
    expect(screen.getByText('Persisted Linear intake item')).toBeVisible();
    expect(screen.queryByText('Persisted GitHub intake item')).not.toBeInTheDocument();
    expect(screen.getByText('Plan onboarding')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Investigate GitHub intake failure')).not.toBeInTheDocument());
  });

  it('shows "Moving to …" on the card while a menu move is in flight, then clears it', async () => {
    const { transitionGate } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    expect(card).toHaveTextContent('Fix login bug');

    await user.click(screen.getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to Planning' }));

    // In flight: the card narrates the destination via a live status row.
    const status = await screen.findByText('Moving to Planning…');
    expect(status.closest('[role="status"]')).not.toBeNull();

    // Server answered: the status row disappears.
    transitionGate.resolve();
    await waitFor(() => expect(screen.queryByText('Moving to Planning…')).not.toBeInTheDocument());
  });

  it('re-queues a failed rule effect from the card', async () => {
    stubBoardEndpoints();
    const retried: string[] = [];
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
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/decision-1/retry`, () => {
        retried.push('decision-1');
        return HttpResponse.json({ decision: { id: 'decision-1', status: 'retry' } });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWorkBoard();

    // A terminal rule effect is only recoverable from the card, so the failure
    // row has to carry the action out of it.
    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(retried).toEqual(['decision-1']));
    await waitForMutationsIdle(client);
  });

  it('links the card details to its attached thread', async () => {
    stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });

    const threadLink = within(dialog).getByRole('link', { name: 'Open session' });
    expect(threadLink).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`,
    );
    const matches = matchRoutes(createAppRoutes(), threadLink.getAttribute('href') ?? '');
    expect(matches?.at(-1)?.route.path).toBe('threads/:threadId');
  });

  it('shows a related PR as a compact link to the exact source item', async () => {
    const user = userEvent.setup();
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [workItem, relatedPullRequest] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });

    const relatedLink = within(card).getByRole('link', {
      name: 'Open in GitHub: Review: PR #21565 — Review login fix, Open pull request',
    });
    expect(relatedLink).toHaveTextContent('PR #21565');
    expect(relatedLink).not.toHaveTextContent('Review:');
    expect(relatedLink).toHaveAttribute('href', relatedPullRequest.externalSource.url);
    expect(relatedLink).toHaveAttribute('target', '_blank');
    expect(relatedLink).not.toHaveAttribute('title');

    await user.hover(relatedLink);
    expect(await screen.findByText('Review: PR #21565 · Review login fix · Open pull request')).toBeVisible();

    await user.unhover(relatedLink);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    relatedLink.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Review: PR #21565 · Review login fix · Open pull request',
    );
  });

  it('names an internal related item without repeating its title', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [workItem, { ...manualWorkItem, parentWorkItemId: ITEM_ID }],
        }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    const relatedLink = within(card).getByRole('link', { name: 'Open Work item: Plan onboarding' });
    expect(relatedLink).toHaveAttribute('href', `/factories/${FACTORY_ID}/work`);
    expect(relatedLink).not.toHaveAttribute('target');
  });

  it('links a related card straight to its bound session thread', async () => {
    const liveRelatedPullRequest = {
      ...relatedPullRequest,
      sessions: {
        review: {
          sessionId: 'review-session',
          branch: 'review-pr',
          threadId: 'review-thread',
          startedBy: 'user-1',
        },
      },
    };
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [workItem, liveRelatedPullRequest] }),
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();
    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    const relatedLink = await within(card).findByRole('link', {
      name: 'Open live session for Review: PR #21565 — Review login fix, Open pull request',
    });
    expect(relatedLink).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/workspaces/review-session/threads/review-thread`,
    );
    expect(relatedLink).not.toHaveAttribute('target');
    expect(relatedLink.querySelector('[data-live-session-indicator]')).toBeInTheDocument();

    await user.hover(relatedLink);
    expect(
      await screen.findByText('Review: PR #21565 · Review login fix · Open pull request · Live session'),
    ).toBeVisible();
  });

  it('marks only the cards whose bound session still exists as live', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [workItem, { ...workItem, id: 'fresh-item', title: 'Unstarted work', sessions: {} }],
        }),
      ),
    );
    renderWorkBoard();

    const started = (await screen.findByText('Fix login bug')).closest<HTMLElement>('[data-testid="work-item-card"]');
    const unstarted = (await screen.findByText('Unstarted work')).closest<HTMLElement>(
      '[data-testid="work-item-card"]',
    );
    if (!started || !unstarted) throw new Error('Expected both work item cards');

    // A bound session with nothing to report runs no marker: the way in is the mark.
    expect(within(started).getByRole('link', { name: 'Open session' })).toBeInTheDocument();
    expect(within(unstarted).queryByRole('link', { name: 'Open session' })).toBeNull();
  });

  it('acknowledges a session start from the card details while it is still resolving the session', async () => {
    stubBoardEndpoints();
    const refreshGate = deferred();
    let workItemRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async () => {
        workItemRequests += 1;
        // The start refetches before it can decide to open or create; hold that
        // refetch open so the pre-mutation window is observable.
        if (workItemRequests > 1) await refreshGate.promise;
        return HttpResponse.json({ workItems: [{ ...workItem, sessions: {} }] });
      }),
      http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
        HttpResponse.json({ session: { sessionId: SESSION_ID, branch: 'fix-login' } }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, () =>
        HttpResponse.json({
          prepared: { workItemId: ITEM_ID, threadId: THREAD_ID, sessionId: SESSION_ID, kickoffStatus: 'sent' },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    await user.click(within(dialog).getByRole('button', { name: 'Start session' }));

    // No run mutation exists yet, so this row is the only feedback the click can produce.
    const status = await screen.findByText('Preparing session…');
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(await screen.findByTestId('work-item-card')).toHaveAttribute('aria-busy', 'true');

    refreshGate.resolve();
    await waitFor(() => expect(screen.queryByText('Preparing session…')).not.toBeInTheDocument());
  });

  it('starts one session when the details run control is re-triggered before it resolves', async () => {
    stubBoardEndpoints();
    const refreshGate = deferred();
    let workItemRequests = 0;
    const runStarts: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async () => {
        workItemRequests += 1;
        if (workItemRequests > 1) await refreshGate.promise;
        return HttpResponse.json({ workItems: [{ ...workItem, sessions: {} }] });
      }),
      http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
        HttpResponse.json({ session: { sessionId: SESSION_ID, branch: 'fix-login' } }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
        const body = (await request.json()) as { kickoffKey?: string };
        runStarts.push(body.kickoffKey ?? '');
        return HttpResponse.json({
          prepared: { workItemId: ITEM_ID, threadId: THREAD_ID, sessionId: SESSION_ID, kickoffStatus: 'sent' },
        });
      }),
    );
    // pointerEventsCheck off so clicks reach disabled controls: the attribute alone wouldn't stop a re-dispatch.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { client } = renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));
    let dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    await user.click(within(dialog).getByRole('button', { name: 'Start session' }));

    await screen.findByText('Preparing session…');

    // Reopening mid-flight must present the run as already happening, not offer a second one.
    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));
    dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    expect(within(dialog).getByRole('button', { name: 'Starting…' })).toBeDisabled();

    refreshGate.resolve();
    await waitFor(() => expect(screen.queryByText('Preparing session…')).not.toBeInTheDocument());
    await waitFor(() => expect(runStarts).toHaveLength(1));

    // Both activations unblock on the same gate release, so a duplicate start would already be in flight here.
    await waitForMutationsIdle(client);
    expect(runStarts).toHaveLength(1);
  });

  it('offers "Open in GitHub" on review-board PR cards past intake', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...workItem,
              id: 'pr-item',
              factoryProjectId: FACTORY_ID,
              title: 'Fix flaky retry',
              stages: ['review'],
              sessions: {},
              externalSource: {
                integrationId: 'github',
                type: 'pull-request',
                externalId: '77',
                url: 'https://github.com/acme/app/pull/77',
              },
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/review`] });
    renderWithProviders(<RouterProvider router={router} />);

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix flaky retry' }));
    const githubLink = await screen.findByRole('menuitem', { name: 'Open in GitHub' });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/acme/app/pull/77');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });

  it('opens GitHub and Linear intake issues in their external provider', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            linear: { enabled: true, sourceIds: ['linear-project-1'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues: [], nextCursor: null })),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...workItem,
              id: 'github-item',
              factoryProjectId: FACTORY_ID,
              title: 'GitHub intake issue',
              stages: ['intake'],
              sessions: {},
              externalSource: {
                integrationId: 'github',
                type: 'issue',
                externalId: '42',
                url: 'https://github.com/acme/app/issues/42',
              },
            },
            {
              ...workItem,
              id: 'linear-item',
              factoryProjectId: FACTORY_ID,
              title: 'Linear intake issue',
              stages: ['intake'],
              sessions: {},
              externalSource: {
                integrationId: 'linear',
                type: 'issue',
                externalId: 'ENG-42',
                url: 'https://linear.app/acme/issue/ENG-42/linear-intake-issue',
              },
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for GitHub intake issue' }));
    const githubLink = await screen.findByRole('menuitem', { name: 'Open in GitHub' });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/acme/app/issues/42');
    expect(githubLink).toHaveAttribute('target', '_blank');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Linear' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Linear intake issue' }));
    const linearLink = await screen.findByRole('menuitem', { name: 'Open in Linear' });
    expect(linearLink).toHaveAttribute('href', 'https://linear.app/acme/issue/ENG-42/linear-intake-issue');
    expect(linearLink).toHaveAttribute('target', '_blank');
  });

  it('offers "Open in GitHub" on unfiled Intake candidates', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.has('label')
            ? []
            : [
                {
                  number: 43,
                  title: 'Unfiled GitHub intake issue',
                  url: 'https://github.com/acme/app/issues/43',
                  author: 'octocat',
                  labels: [],
                  comments: 0,
                  createdAt: '2026-07-28T00:00:00.000Z',
                  updatedAt: '2026-07-28T00:00:00.000Z',
                },
              ],
          nextPage: null,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Unfiled GitHub intake issue' }));
    const githubLink = await screen.findByRole('menuitem', { name: 'Open in GitHub' });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/acme/app/issues/43');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });

  it('identifies Slack-created work items as Slack instead of Manual', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...workItem,
              id: 'slack-item',
              factoryProjectId: FACTORY_ID,
              title: 'Slack request',
              stages: ['execute'],
              sessions: {},
              externalSource: {
                integrationId: 'slack',
                type: 'slack-thread',
                externalId: 'slack:C-1:1700.42',
                url: 'https://app.slack.com/client/T-1/C-1/thread/C-1-170042',
              },
            },
          ],
        }),
      ),
    );
    renderWorkBoard();

    const title = await screen.findByText('Slack request');
    const card = title.closest<HTMLElement>('[data-testid="work-item-card"]');
    if (!card) throw new Error('Expected the title inside its work item card');
    expect(within(card).getByText(/^Slack · /)).toBeInTheDocument();
    expect(within(card).queryByText(/^Manual · /)).not.toBeInTheDocument();
  });

  it('ignores a card dropped back into its current column', async () => {
    const { transitionRequests } = stubBoardEndpoints();
    renderWorkBoard();

    const titleText = await screen.findByText('Fix login bug');
    const card = titleText.closest<HTMLElement>('[data-testid="work-item-card"]');
    if (!card) throw new Error('Expected the title inside its work item card');
    const currentColumn = screen.getByTestId('board-column-triage');
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(titleText, { dataTransfer });
    fireEvent.dragOver(currentColumn, { dataTransfer });
    fireEvent.drop(currentColumn, { dataTransfer });
    await delay(50);

    expect(transitionRequests).toEqual([]);
    expect(currentColumn).toContainElement(card);
  });

  it('moves a card when it is dropped into a collapsed empty column', async () => {
    const { transitionGate, transitionRequests } = stubBoardEndpoints();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    const planningColumn = screen.getByTestId('board-column-planning');
    expect(planningColumn).toHaveAccessibleName('Planning, empty');
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(planningColumn, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe('move');
    fireEvent.drop(planningColumn, { dataTransfer });

    await waitFor(() => expect(transitionRequests).toEqual([ITEM_ID]));
    expect(within(planningColumn).getByTestId('work-item-card')).toHaveTextContent('Fix login bug');

    transitionGate.resolve();
    await waitFor(() => expect(screen.queryByText('Moving to Planning…')).not.toBeInTheDocument());
  });

  it('creates a manual work item in the selected active column', async () => {
    stubBoardEndpoints();
    let created = false;
    let stage = 'intake';
    let revision = 1;
    let createRequest: unknown;
    let transitionRequest: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: created ? [workItem, { ...manualWorkItem, stages: [stage], revision }] : [workItem],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
        createRequest = await request.json();
        created = true;
        return HttpResponse.json({ workItem: manualWorkItem });
      }),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${manualWorkItem.id}/transition`,
        async ({ request }) => {
          transitionRequest = await request.json();
          stage = 'planning';
          revision = 2;
          return HttpResponse.json({
            result: {
              status: 'accepted',
              transitionId: 'transition-manual-1',
              itemId: manualWorkItem.id,
              revision,
              stage,
              decisions: [],
            },
          });
        },
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    const planningColumn = await screen.findByTestId('board-column-planning');
    await waitFor(() => expect(planningColumn).toHaveAccessibleName('Planning, empty'));

    for (const label of ['Intake', 'Triage', 'Planning', 'Building', 'Review']) {
      expect(screen.getByRole('button', { name: `Create work item in ${label}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Create work item in Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create work item in Canceled' })).not.toBeInTheDocument();

    const getPlanningTrigger = () => screen.getByRole('button', { name: 'Create work item in Planning' });
    await user.click(getPlanningTrigger());
    const composer = await within(planningColumn).findByRole('form', { name: 'New work item in Planning' });
    expect(planningColumn).toHaveAccessibleName('Planning');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(composer).getByText('Manual · new')).toBeInTheDocument();
    expect(within(composer).getByRole('textbox', { name: 'Work item title' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'New work item in Planning' })).not.toBeInTheDocument(),
    );
    expect(getPlanningTrigger()).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(getPlanningTrigger()).toHaveFocus());

    await user.click(getPlanningTrigger());
    const canceledComposer = await within(planningColumn).findByRole('form', { name: 'New work item in Planning' });
    await user.click(within(canceledComposer).getByRole('button', { name: 'Cancel new work item' }));
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'New work item in Planning' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(getPlanningTrigger()).toHaveFocus());

    await user.click(getPlanningTrigger());
    const submittedComposer = await within(planningColumn).findByRole('form', {
      name: 'New work item in Planning',
    });
    const titleInput = within(submittedComposer).getByRole('textbox', { name: 'Work item title' });
    await user.type(titleInput, 'Plan onboarding');
    await user.click(within(submittedComposer).getByRole('button', { name: 'Add work item to Planning' }));

    await waitFor(() => expect(createRequest).toEqual({ title: 'Plan onboarding', stages: ['intake'] }));
    await waitFor(() =>
      expect(transitionRequest).toEqual(
        expect.objectContaining({
          board: 'work',
          stage: 'planning',
          expectedRevision: 1,
          cause: 'manual_creation',
        }),
      ),
    );
    expect(await within(planningColumn).findByText('Plan onboarding')).toBeInTheDocument();
    await waitFor(() => expect(getPlanningTrigger()).toHaveFocus());
  });

  it('keeps transition errors inline and retries the same manual work item', async () => {
    stubBoardEndpoints();
    let created = false;
    let title = manualWorkItem.title;
    let stage = 'intake';
    let revision = 1;
    let createRequests = 0;
    const updateRequests: unknown[] = [];
    const transitionRequests: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: created ? [workItem, { ...manualWorkItem, title, stages: [stage], revision }] : [workItem],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => {
        createRequests += 1;
        created = true;
        return HttpResponse.json({ workItem: manualWorkItem });
      }),
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${manualWorkItem.id}`, async ({ request }) => {
        updateRequests.push(await request.json());
        title = 'Plan onboarding v2';
        revision = 2;
        return HttpResponse.json({ workItem: { ...manualWorkItem, title, stages: [stage], revision } });
      }),
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${manualWorkItem.id}/transition`,
        async ({ request }) => {
          transitionRequests.push(await request.json());
          if (transitionRequests.length === 1) {
            return HttpResponse.json(
              {
                result: {
                  status: 'rejected',
                  code: 'planning_blocked',
                  reason: 'Planning needs approval',
                },
              },
              { status: 422 },
            );
          }

          stage = 'planning';
          revision = 3;
          return HttpResponse.json({
            result: {
              status: 'accepted',
              transitionId: 'transition-manual-2',
              itemId: manualWorkItem.id,
              revision,
              stage,
              decisions: [],
            },
          });
        },
      ),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    const planningColumn = await screen.findByTestId('board-column-planning');
    await waitFor(() => expect(planningColumn).toHaveAccessibleName('Planning, empty'));
    await user.click(screen.getByRole('button', { name: 'Create work item in Planning' }));
    const composer = await within(planningColumn).findByRole('form', { name: 'New work item in Planning' });
    const titleInput = within(composer).getByRole('textbox', { name: 'Work item title' });
    await user.type(titleInput, manualWorkItem.title);
    await user.click(within(composer).getByRole('button', { name: 'Add work item to Planning' }));

    expect(await within(composer).findByRole('alert')).toHaveTextContent('Planning needs approval');
    const retryComposer = screen.getByRole('form', { name: 'New work item in Planning' });
    const retryTitleInput = within(retryComposer).getByRole('textbox', { name: 'Work item title' });
    expect(retryTitleInput).toHaveValue(manualWorkItem.title);
    await waitFor(() => expect(retryTitleInput).toHaveFocus());
    expect(createRequests).toBe(1);
    expect(transitionRequests).toHaveLength(1);
    expect(
      await within(screen.getByTestId('board-column-intake')).findByText(manualWorkItem.title),
    ).toBeInTheDocument();

    await user.clear(retryTitleInput);
    await user.type(retryTitleInput, 'Plan onboarding v2');
    await user.click(within(retryComposer).getByRole('button', { name: 'Add work item to Planning' }));

    await waitFor(() => expect(updateRequests).toEqual([{ title: 'Plan onboarding v2' }]));
    await waitFor(() =>
      expect(transitionRequests).toEqual([
        expect.objectContaining({ expectedRevision: 1, cause: 'manual_creation' }),
        expect.objectContaining({ expectedRevision: 2, cause: 'manual_creation' }),
      ]),
    );
    expect(createRequests).toBe(1);
    expect(await within(planningColumn).findByText('Plan onboarding v2')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create work item in Planning' })).toHaveFocus());
  });
});
