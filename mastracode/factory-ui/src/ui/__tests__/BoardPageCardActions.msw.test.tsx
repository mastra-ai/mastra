import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { releaseBoard, workBoardInfo } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { providerFactsCard } from './fixtures/providerFactsCard';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

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
  metadata: { identifier: 'ENG-42', linearIssueId: 'linear-issue-1' },
};

interface TransitionRequest {
  itemId: string;
  body: Record<string, unknown>;
}

function stubBoardEndpoints({
  workItems = [issueWorkItem] as object[],
  multiRepository = false,
  mappedLinearRepository = false,
} = {}) {
  const transitions: TransitionRequest[] = [];
  const patches: Array<{ itemId: string; body: Record<string, unknown> }> = [];
  const created: Array<Record<string, unknown>> = [];

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
            repositories: [
              listedRepository(REPO_ID, 'acme/app', { branch: 'main' }),
              ...(multiRepository ? [listedRepository('repo-2', 'acme/other', { branch: 'main' })] : []),
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
          linear: {
            enabled: multiRepository,
            sourceIds: multiRepository ? ['linear-project-1'] : null,
            ...(mappedLinearRepository ? { repositoryByLinearProject: { 'linear-project-1': 'acme/other' } } : {}),
          },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
      HttpResponse.json({
        bindings: multiRepository
          ? [{ integrationId: 'linear', sourceId: 'linear-project-1', factoryProjectId: FACTORY_ID, board: 'work' }]
          : [],
      }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: multiRepository, connected: multiRepository, workspace: null }),
    ),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => HttpResponse.json({ enabled: false, configured: false })),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      created.push(body);
      return HttpResponse.json({
        workItem: { ...issueWorkItem, id: 'item-filed', title: String(body.title), stages: ['intake'] },
      });
    }),
    http.patch(`${TEST_BASE_URL}/web/factory/work-items/:itemId`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push({ itemId: String(params.itemId), body });
      return HttpResponse.json({
        workItem: {
          ...issueWorkItem,
          id: String(params.itemId),
          revision: 5,
          ...(body.metadata ? { metadata: body.metadata } : {}),
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

  return { transitions, patches, created };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

async function moveFromCard(cardTitle: string, action: string) {
  const user = userEvent.setup();
  const card = await screen.findByRole('article', { name: cardTitle });
  await user.click(await within(card).findByRole('button', { name: action }));
}

describe('Board card buttons move the card', () => {
  it('moves a card using its normalized source repository mapping without prompting for a repository', async () => {
    const item = {
      ...linearWorkItem,
      stages: ['intake'],
      metadata: { linearProjectId: 'stale-project', authorTrusted: true },
      workItem: {
        ...providerFactsCard.workItem,
        provider: 'linear',
        title: linearWorkItem.title,
        key: 'ENG-42',
        state: 'open',
        metadata: { ...linearWorkItem.metadata, linearProjectId: 'linear-project-1' },
      },
    };
    const { patches, transitions } = stubBoardEndpoints({
      multiRepository: true,
      mappedLinearRepository: true,
      workItems: [item],
    });
    renderWorkBoard();

    await moveFromCard(item.title, 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(patches).toHaveLength(0);
    expect(transitions[0]).toMatchObject({ itemId: item.id, body: { stage: 'triage' } });
  });

  it('issues a transition to Triage with cause card_action when Investigate is clicked', async () => {
    const { transitions } = stubBoardEndpoints({ workItems: [intakeWorkItem] });
    renderWorkBoard();

    await moveFromCard('Fix login bug', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({
      itemId: 'item-1',
      body: { board: 'work', stage: 'triage', cause: 'card_action', expectedRevision: 1 },
    });
    expect(transitions[0]?.body).not.toHaveProperty('reenter');
  });

  it('moves a card that names no repository in a multi-repository factory with one transition and no repository prompt', async () => {
    const { patches, transitions } = stubBoardEndpoints({
      multiRepository: true,
      workItems: [{ ...linearWorkItem, stages: ['intake'] }],
    });
    const { client } = renderWorkBoard();

    await moveFromCard('ENG-42: Fix intake sync', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({
      itemId: 'linear-item-1',
      body: { stage: 'triage', cause: 'card_action', expectedRevision: 1 },
    });
    await waitForMutationsIdle(client);
    expect(transitions).toHaveLength(1);
    expect(patches).toEqual([]);
    // The card's own details are the only dialog: nothing asks for a repository.
    expect(screen.queryAllByRole('dialog', { name: name => name !== 'ENG-42: Fix intake sync' })).toEqual([]);
  });

  it('uses the configured Linear project repository without prompting', async () => {
    const { patches, transitions } = stubBoardEndpoints({
      multiRepository: true,
      mappedLinearRepository: true,
      workItems: [
        {
          ...linearWorkItem,
          stages: ['intake'],
          metadata: { ...linearWorkItem.metadata, linearProjectId: 'linear-project-1' },
        },
      ],
    });
    renderWorkBoard();

    await moveFromCard('ENG-42: Fix intake sync', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(patches).toHaveLength(0);
  });

  it("re-enters the lane when the card's own lane button is clicked", async () => {
    const { transitions } = stubBoardEndpoints();
    renderWorkBoard();

    await moveFromCard('Fix login bug', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]?.body).toMatchObject({ stage: 'triage', cause: 'card_action', reenter: true });
  });

  it('offers Investigate and Plan from the menu of an intake card', async () => {
    stubBoardEndpoints();
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));

    expect(await screen.findByRole('menuitem', { name: 'Investigate' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Plan' })).toBeVisible();
  });

  it("keeps Work's moves against a server older than the board loop", async () => {
    const { flow: _flow, ...olderWork } = workBoardInfo;
    const { transitions } = stubBoardEndpoints({ workItems: [intakeWorkItem] });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
        HttpResponse.json({ boards: [olderWork] }),
      ),
    );
    renderWorkBoard();

    await moveFromCard('Fix login bug', 'Investigate');

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({ itemId: 'item-1', body: { board: 'work', stage: 'triage' } });
  });

  it('offers Prepare approval on a triaged card that needs approval', async () => {
    stubBoardEndpoints({
      workItems: [
        { ...issueWorkItem, metadata: { number: 7, labels: ['status: needs approval'] }, stages: ['triage'] },
      ],
    });
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    expect(await screen.findByRole('menuitem', { name: 'Prepare approval' })).toBeVisible();
  });

  it('offers the ordinary runs once a person moved a labelled card into a working lane, before the label catches up', async () => {
    stubBoardEndpoints({
      workItems: [
        {
          ...issueWorkItem,
          metadata: { number: 7, labels: ['status: needs approval'] },
          stages: ['planning'],
        },
      ],
    });
    renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    await screen.findByRole('menuitem', { name: 'Build' });
    expect(screen.queryByRole('menuitem', { name: 'Prepare approval' })).not.toBeInTheDocument();
  });

  it('moves a card to another board from its menu, offering only non-terminal target phases', async () => {
    const { transitions } = stubBoardEndpoints({ workItems: [intakeWorkItem] });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
        HttpResponse.json({ boards: [workBoardInfo, releaseBoard] }),
      ),
    );
    const { client } = renderWorkBoard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions for Fix login bug' }));
    const boardsTrigger = await screen.findByRole('menuitem', { name: 'Move to board' });
    act(() => boardsTrigger.focus());
    await user.keyboard('{ArrowRight}');
    const releaseTrigger = await screen.findByRole('menuitem', { name: 'Release Preview' });
    act(() => releaseTrigger.focus());
    await user.keyboard('{ArrowRight}');

    await screen.findByRole('menuitem', { name: 'Queued' });
    // A card finishes on its own board: the target's terminal phase is not offered.
    expect(screen.queryByRole('menuitem', { name: 'Shipped' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Queued' }));

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({
      itemId: 'item-1',
      body: { board: 'release', stage: 'queued', cause: 'move_to_board', expectedRevision: 1 },
    });
    await waitForMutationsIdle(client);
    expect(transitions).toHaveLength(1);
  });

  it("links the card's source from the card", async () => {
    stubBoardEndpoints();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    expect(within(card).getByRole('link', { name: 'Open in GitHub: #7' })).toHaveAttribute(
      'href',
      'https://github.com/acme/app/issues/7',
    );
  });
});
