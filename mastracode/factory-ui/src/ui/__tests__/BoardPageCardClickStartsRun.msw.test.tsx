/**
 * Clicking a board card opens its details; committing to work happens through
 * the dialog's run button. The run still starts with its invocation so the
 * resulting thread gets a kickoff message instead of an empty "What can I help
 * you build?" session. Only items with no run spec fall back to a plain session.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

// Wire shape as served by /web/factory/*/work-items: the client derives
// `source`/`url` from `externalSource` (see fromWireWorkItem).
const issueWorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:7',
    url: 'https://github.com/acme/app/issues/7',
  },
  parentWorkItemId: null,
  title: 'Fix login bug',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 7 },
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const linearWorkItem = {
  ...issueWorkItem,
  id: 'linear-item-1',
  externalSource: {
    integrationId: 'linear',
    type: 'issue',
    externalId: 'linear:linear-issue-1',
    url: 'https://linear.app/acme/issue/ENG-42/fix-intake-sync',
  },
  title: 'ENG-42: Fix intake sync',
  metadata: { identifier: 'ENG-42' },
};

/**
 * Stubs the board's data endpoints and captures run-start requests. The run
 * start never resolves, keeping the test on the board (no thread navigation).
 */
function stubBoardEndpoints({ issues = [] as object[], workItems = [issueWorkItem] as object[] } = {}) {
  const startRequests: Array<Record<string, unknown>> = [];

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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
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
    // The label-filtered (status: auto-triaged) feed stays empty; the plain feed
    // serves the candidate under test.
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, ({ request }) => {
      const label = new URL(request.url).searchParams.get('label');
      if (label && label !== 'status: auto-triaged') {
        return HttpResponse.error();
      }

      return HttpResponse.json({ issues: label ? [] : issues, nextPage: null });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues/:number`, ({ params }) =>
      HttpResponse.json({
        number: Number(params.number),
        title: 'Crash on logout',
        url: `https://github.com/acme/app/issues/${String(params.number)}`,
        author: 'octocat',
        labels: [],
        comments: 0,
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
        description: 'The app crashes when logging out.',
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs/:number`, () =>
      HttpResponse.json({ error: 'pull_request_not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ session: { sessionId: 'session-1', branch: 'factory/issue-7' } }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      startRequests.push((await request.json()) as Record<string, unknown>);
      await new Promise(() => {}); // never resolves — assertions read startRequests
      return HttpResponse.json({});
    }),
  );

  return { startRequests };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

/** Opens a card's detail dialog and starts its primary run from the footer. */
async function startRunFromCardDetails(cardTitle: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Details for ${cardTitle}` }));

  const dialog = await screen.findByRole('dialog', { name: cardTitle });
  await user.click(within(dialog).getByRole('button', { name: 'Investigate' }));
}

describe('Board card details open the default run', () => {
  it('starts the default run with its invocation from a sessionless work-item card details', async () => {
    const { startRequests } = stubBoardEndpoints();
    renderWorkBoard();

    await startRunFromCardDetails('Fix login bug');

    await waitFor(() => expect(startRequests).toHaveLength(1));
    expect(startRequests[0]).toMatchObject({
      destinationStage: 'triage',
      invocation: { type: 'skill', skillName: 'factory-triage' },
      workItem: { id: 'item-1', role: 'triage' },
    });
  });

  it('starts a persisted Linear Triage item with the Linear kickoff invocation', async () => {
    const { startRequests } = stubBoardEndpoints({ workItems: [linearWorkItem] });
    renderWorkBoard();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for ENG-42: Fix intake sync' }));
    const dialog = await screen.findByRole('dialog', { name: 'ENG-42: Fix intake sync' });
    await user.click(within(dialog).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(startRequests).toHaveLength(1));
    expect(startRequests[0]).toMatchObject({
      destinationStage: 'planning',
      invocation: {
        type: 'skill',
        skillName: 'factory-triage',
        arguments: expect.stringContaining(
          `Linear issue ENG-42 (https://linear.app/acme/issue/ENG-42/fix-intake-sync)\n\n` +
            `Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`,
        ),
      },
      workItem: { id: 'linear-item-1', role: 'plan' },
    });
  });

  it('shows the source description in the dialog and runs a candidate card from it', async () => {
    const { startRequests } = stubBoardEndpoints({
      issues: [
        {
          number: 9,
          title: 'Crash on logout',
          url: 'https://github.com/acme/app/issues/9',
          author: 'octocat',
          labels: [],
          comments: 0,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
        },
      ],
    });
    renderWorkBoard();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Crash on logout' }));
    const dialog = await screen.findByRole('dialog', { name: 'Crash on logout' });
    expect(await within(dialog).findByText('The app crashes when logging out.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Investigate' }));

    await waitFor(() => expect(startRequests).toHaveLength(1));
    expect(startRequests[0]).toMatchObject({
      destinationStage: 'triage',
      invocation: { type: 'skill', skillName: 'factory-triage' },
      workItem: { role: 'triage' },
    });
  });

  // Run clicks refetch worktrees before deciding what to do. When that
  // refetch fails (e.g. the auth cookie expired overnight), the click used to
  // die silently — no run, no toast, nothing. It must surface an error.
  it('shows an error toast instead of failing silently when the pre-start refetch fails', async () => {
    const { startRequests } = stubBoardEndpoints();
    // First sessions read (board load) succeeds; later refetches 401 like an
    // expired session would.
    let sessionsCalls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => {
        sessionsCalls += 1;
        if (sessionsCalls === 1) return HttpResponse.json({ sessions: [] });
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
      }),
    );
    // The Toaster normally mounts in main.tsx, above the router.
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(
      <>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </>,
    );

    await startRunFromCardDetails('Fix login bug');

    await waitFor(() => expect(screen.getByText(/failed to (list sessions|refresh)/i)).toBeInTheDocument());
    expect(startRequests).toHaveLength(0);
  });
});
