/**
 * A card's button is a move: it transitions the card into the lane whose rule
 * runs the work, and the lane's own button re-enters it. Nothing here starts a
 * run directly — the server's rules do, off the transition.
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

const logoutIssue = {
  number: 9,
  title: 'Crash on logout',
  url: 'https://github.com/acme/app/issues/9',
  author: 'octocat',
  labels: [],
  comments: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const intakeWorkItem = { ...issueWorkItem, stages: ['intake'] };

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

interface TransitionRequest {
  itemId: string;
  body: Record<string, unknown>;
}

/** Stubs the board's data endpoints and captures everything a card click writes. */
function stubBoardEndpoints({ issues = [] as object[], workItems = [issueWorkItem] as object[] } = {}) {
  const transitions: TransitionRequest[] = [];
  const patches: Array<{ itemId: string; body: Record<string, unknown> }> = [];
  const created: Array<Record<string, unknown>> = [];
  const comments: Array<{ itemId: string; body: Record<string, unknown> }> = [];

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
    http.get(`${TEST_BASE_URL}/web/linear/issues/:identifier`, ({ params }) =>
      HttpResponse.json({
        identifier: String(params.identifier),
        title: 'Fix intake sync',
        url: 'https://linear.app/acme/issue/ENG-42/fix-intake-sync',
        description: 'The sync runs the wrong way.',
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs/:number`, () =>
      HttpResponse.json({ error: 'pull_request_not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      created.push(body);
      return HttpResponse.json({
        workItem: { ...issueWorkItem, id: 'item-filed', title: String(body.title), stages: ['intake'] },
      });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/work-items/:itemId/comments`, async ({ params, request }) => {
      comments.push({ itemId: String(params.itemId), body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ comment: { id: 'comment-1' } });
    }),
    http.patch(`${TEST_BASE_URL}/web/factory/work-items/:itemId`, async ({ params, request }) => {
      patches.push({ itemId: String(params.itemId), body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({
        workItem: {
          ...issueWorkItem,
          id: String(params.itemId),
          revision: 5,
          plansPreapprovedAt: '2026-07-18T01:00:00.000Z',
        },
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
      async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        transitions.push({ itemId: String(params.itemId), body });
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: `transition-${transitions.length}`,
            itemId: String(params.itemId),
            revision: 9,
            stage: body.stage,
            decisions: [],
          },
        });
      },
    ),
  );

  return { transitions, patches, created, comments };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

async function moveFromCardDetails(cardTitle: string, action: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Details for ${cardTitle}` }));

  const dialog = await screen.findByRole('dialog', { name: cardTitle });
  await user.click(within(dialog).getByRole('button', { name: action }));
}

describe('Board card buttons move the card', () => {
  it('issues a transition to Triage with cause card_action when Investigate is clicked', async () => {
    const { transitions } = stubBoardEndpoints({ workItems: [intakeWorkItem] });
    renderWorkBoard();

    await moveFromCardDetails('Fix login bug', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({
      itemId: 'item-1',
      body: { board: 'work', stage: 'triage', cause: 'card_action', expectedRevision: 1 },
    });
    expect(transitions[0]?.body).not.toHaveProperty('reenter');
  });

  it("re-enters the lane when the card's own lane button is clicked", async () => {
    const { transitions } = stubBoardEndpoints();
    renderWorkBoard();

    await moveFromCardDetails('Fix login bug', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]?.body).toMatchObject({ stage: 'triage', cause: 'card_action', reenter: true });
  });

  it('patches plansPreapproved hands-off, then transitions against the revision the patch returned', async () => {
    const { transitions, patches } = stubBoardEndpoints();
    const { client } = renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Investigate hands-off' }));

    await waitFor(() => expect(transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(patches).toEqual([{ itemId: 'item-1', body: { plansPreapproved: true } }]);
    expect(transitions[0]?.body).toMatchObject({ stage: 'triage', cause: 'card_action', expectedRevision: 5 });
  });

  it('stamps a card hands-off once when the menu item is clicked twice', async () => {
    const { transitions, patches } = stubBoardEndpoints();
    let releasePatch = () => {};
    const patchInFlight = new Promise<void>(resolve => {
      releasePatch = resolve;
    });
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/:itemId`, async ({ params, request }) => {
        patches.push({ itemId: String(params.itemId), body: (await request.json()) as Record<string, unknown> });
        await patchInFlight;
        return HttpResponse.json({ workItem: { ...issueWorkItem, id: String(params.itemId), revision: 5 } });
      }),
    );
    const { client } = renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Investigate hands-off' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Investigate hands-off' }));
    releasePatch();

    await waitFor(() => expect(transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(patches).toHaveLength(1);
  });

  it('files a candidate in Intake, posts its custom prompt as a comment, then moves it', async () => {
    const { transitions, created, comments } = stubBoardEndpoints({
      issues: [logoutIssue],
    });
    const { client } = renderWorkBoard();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Crash on logout' }));
    const dialog = await screen.findByRole('dialog', { name: 'Crash on logout' });
    expect(await within(dialog).findByText('The app crashes when logging out.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Custom prompt…' }));
    await user.type(await screen.findByRole('textbox', { name: 'Prompt for Crash on logout' }), 'Check the token TTL');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(transitions).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(created).toEqual([expect.objectContaining({ title: 'Crash on logout', stages: ['intake'] })]);
    expect(comments).toEqual([
      { itemId: 'item-filed', body: expect.objectContaining({ body: 'Guidance for this run: Check the token TTL' }) },
    ]);
    expect(transitions[0]).toMatchObject({ itemId: 'item-filed', body: { stage: 'triage', cause: 'card_action' } });
  });

  it('reports the guidance that could not be posted, and leaves the card in Intake', async () => {
    const { transitions } = stubBoardEndpoints({ issues: [logoutIssue] });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/work-items/:itemId/comments`, () =>
        HttpResponse.json({ error: 'The guidance could not be posted.' }, { status: 500 }),
      ),
    );
    renderWorkBoard();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Crash on logout' }));
    const dialog = await screen.findByRole('dialog', { name: 'Crash on logout' });
    await user.click(within(dialog).getByRole('button', { name: 'Custom prompt…' }));
    await user.type(await screen.findByRole('textbox', { name: 'Prompt for Crash on logout' }), 'Check the token TTL');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(await screen.findByText('The guidance could not be posted.')).toBeInTheDocument();
    expect(transitions).toEqual([]);
  });

  it('offers no hands-off twin for Prepare approval, whose outcome is a maintainer decision', async () => {
    stubBoardEndpoints({
      workItems: [
        { ...issueWorkItem, metadata: { number: 7, labels: ['status: needs approval'] }, stages: ['triage'] },
      ],
    });
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await screen.findByRole('menuitem', { name: 'Prepare approval' });
    expect(screen.queryByRole('menuitem', { name: 'Prepare approval hands-off' })).not.toBeInTheDocument();
  });

  it('offers the ordinary runs once a labelled card sits in a working lane, even before acceptance was recorded', async () => {
    stubBoardEndpoints({
      workItems: [
        {
          ...issueWorkItem,
          metadata: { number: 7, labels: ['status: needs approval'] },
          stages: ['planning'],
          triageType: 'feature request',
          acceptedAt: null,
        },
      ],
    });
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await screen.findByRole('menuitem', { name: 'Build' });
    expect(screen.queryByRole('menuitem', { name: 'Prepare approval' })).not.toBeInTheDocument();
  });

  it("shows a Linear card's own description in its details", async () => {
    stubBoardEndpoints({ workItems: [linearWorkItem] });
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Details for ENG-42: Fix intake sync' }));

    const dialog = await screen.findByRole('dialog', { name: 'ENG-42: Fix intake sync' });
    expect(await within(dialog).findByText('The sync runs the wrong way.')).toBeInTheDocument();
  });

  it('links the card source from the panel header', async () => {
    stubBoardEndpoints();
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));

    const dialog = await screen.findByRole('dialog', { name: 'Fix login bug' });
    expect(within(dialog).getByRole('link', { name: 'Open in GitHub: #7' })).toHaveAttribute(
      'href',
      'https://github.com/acme/app/issues/7',
    );
  });
});
