/**
 * A phase with an agent or an exit tool shows its setup in its column header (board layout) and its group header
 * (list layout): who works the card, whether it starts on its own, and how its exit tool's success is approved. The
 * header opens the phase's settings; its card reads the phase step by step and switches starting on its own.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoard, workBoardCatalog } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import type { BoardCatalogResponse, ReplaceBoardBody } from '../../api/types';
import { storedWorkBoard } from '../domains/boardConfig/__tests__/fixtures/work-board';
import { rule } from '../domains/boardRules/__tests__/fixtures/rulesServer';
import type { WorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

/** A work item as the server sends it: the client maps the project id and source onto `WorkItem`. */
type WireWorkItem = Omit<WorkItem, 'githubProjectId' | 'source' | 'sourceKey' | 'url'> & {
  factoryProjectId: string;
  externalSource: { integrationId: string; type: string; externalId: string } | null;
};

function card(id: string, issue: number, title: string, stage: string): WireWorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: { integrationId: 'github', type: 'issue', externalId: `github-issue:${issue}` },
    triageType: null,
    acceptedAt: null,
    board: 'work',
    parentWorkItemId: null,
    title,
    stages: [stage],
    stageHistory: [],
    sessions: {},
    metadata: {},
    description: null,
    revision: 1,
    createdAt: '2026-11-06T08:00:00.000Z',
    updatedAt: '2026-11-06T08:00:00.000Z',
  };
}

const workItems = [card('item-1', 1, 'Plan the loader', 'planning'), card('item-2', 2, 'Build the loader', 'execute')];

/** The Work board as a project stores it, its plans approved on their own for low-effort cards. */
const storedCatalog: BoardCatalogResponse = {
  boards: [
    {
      ...workBoard,
      source: 'stored',
      phases: workBoard.phases.map(phase =>
        phase.id === 'planning'
          ? {
              ...phase,
              skill: 'factory-plan',
              exitTool: {
                id: 'submit_plan',
                autoApprove: true,
                autoApproveWhen: {
                  operator: 'AND',
                  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
                },
              },
            }
          : phase,
      ),
    },
    ...workBoardCatalog.boards.slice(1),
  ],
};

function stubWorkBoard(catalog: BoardCatalogResponse) {
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () => HttpResponse.json(catalog)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, () =>
      HttpResponse.json(storedWorkBoard()),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
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

function renderWorkBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work${search}`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

/** The board layout's header row for a phase: its heading's row. */
async function columnHeader(label: string) {
  const heading = await screen.findByRole('heading', { name: label, level: 2 });
  return heading.closest<HTMLElement>('[data-board-stage]')!;
}

describe('Board phase setup', () => {
  it("shows Planning's agent and exit tool in its column header, linked to its settings", async () => {
    stubWorkBoard(storedCatalog);
    renderWorkBoard('?layout=board');

    const planning = await columnHeader('Planning');
    const setup = await within(planning).findByRole('link', {
      name: 'Planning runs factory-plan. Started by hand. Planning ends when submit_plan succeeds. Approved on its own only if labels contains effort:low.',
    });
    expect(setup).toHaveAttribute('href', `/factories/${FACTORY_ID}/work/config/planning`);

    const done = await columnHeader('Done');
    expect(within(done).queryByRole('link', { name: /runs|ends when/ })).not.toBeInTheDocument();
  });

  it('says on hover who works the card, when it starts, and how its work ends', async () => {
    const user = userEvent.setup();
    stubWorkBoard(storedCatalog);
    renderWorkBoard('?layout=board');

    const planning = await columnHeader('Planning');
    await user.hover(await within(planning).findByRole('link', { name: /ends when submit_plan/ }));
    expect(await screen.findByText('Ends with')).toBeVisible();
    expect(screen.getByText('Approved on its own only if labels contains effort:low')).toBeVisible();
  });

  it('keeps one card open, showing the phase last hovered', async () => {
    const user = userEvent.setup();
    const [work, ...others] = storedCatalog.boards;
    const phases = work.phases.map(phase => (phase.id === 'execute' ? { ...phase, skill: 'factory-build' } : phase));
    stubWorkBoard({ ...storedCatalog, boards: [{ ...work, phases }, ...others] });
    renderWorkBoard('?layout=board');

    await user.hover(await within(await columnHeader('Planning')).findByRole('link', { name: /runs factory-plan/ }));
    expect(await screen.findByRole('list', { name: 'Planning, step by step' })).toBeVisible();

    await user.hover(await within(await columnHeader('Building')).findByRole('link', { name: /runs factory-build/ }));
    expect(await screen.findByRole('list', { name: 'Building, step by step' })).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole('list', { name: /, step by step$/ })).toHaveLength(1));
  });

  it("shows the same in the list layout's group headers", async () => {
    stubWorkBoard(workBoardCatalog);
    renderWorkBoard();

    const planning = await screen.findByTestId('board-column-planning');
    expect(
      await within(planning).findByRole('link', {
        name: /Planning ends when submit_plan succeeds\. A person approves it\./,
      }),
    ).toBeInTheDocument();
  });

  it('reads the phase step by step on hover, and starts it on its own from there', async () => {
    const user = userEvent.setup();
    stubWorkBoard(storedCatalog);
    const saved: ReplaceBoardBody[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake-routes`, () =>
        HttpResponse.json({
          intakeRoutes: [
            rule({
              name: 'Plans go to Planning',
              on: ['work_item.updated'],
              when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'plan' }] },
              target: { boardKey: 'work', phaseKey: 'planning', joinClosedIssue: false, moveToBoardKey: null },
            }),
          ],
          canEdit: true,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, () =>
        HttpResponse.json(storedWorkBoard()),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, async ({ request }) => {
        const body = (await request.json()) as ReplaceBoardBody;
        saved.push(body);
        const phases = storedWorkBoard().board.phases.map(phase => ({
          ...phase,
          autoStart: body.phases.find(sent => sent.key === phase.key)?.autoStart,
        }));
        return HttpResponse.json(storedWorkBoard({ phases, revision: 2 }));
      }),
    );
    const { client } = renderWorkBoard('?layout=board');

    await user.hover(
      await within(await columnHeader('Planning')).findByRole('link', { name: /ends when submit_plan/ }),
    );
    const steps = await screen.findByRole('list', { name: 'Planning, step by step' });
    const rules = await within(steps).findByRole('list', { name: 'Rules that move cards into Planning' });
    expect(within(rules).getByText('Labels contains plan')).toBeVisible();
    expect(within(steps).getByText('Started by hand')).toBeVisible();
    expect(within(steps).getByText('Next')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Rules into Planning' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/rules?into=planning`,
    );
    expect(screen.getByRole('link', { name: 'Phase settings' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/config/planning`,
    );

    await user.click(await within(steps).findByRole('switch', { name: 'Planning: start on its own' }));
    await waitForMutationsIdle(client);
    expect(saved).toHaveLength(1);
    expect(saved[0].expectedRevision).toBe(1);
    expect(saved[0].phases.find(phase => phase.key === 'planning')?.autoStart).toBe(true);
    expect(saved[0].phases.find(phase => phase.key === 'execute')?.autoStart).toBe(
      storedWorkBoard().board.phases.find(phase => phase.key === 'execute')?.autoStart,
    );
  });

  it('reloads the board when someone saved it first, so trying again saves against their version', async () => {
    const user = userEvent.setup();
    const sentRevisions: number[] = [];
    let revision = 1;
    stubWorkBoard(storedCatalog);
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake-routes`, () =>
        HttpResponse.json({ intakeRoutes: [], canEdit: true }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, () =>
        HttpResponse.json(storedWorkBoard({ revision })),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, async ({ request }) => {
        const body = (await request.json()) as ReplaceBoardBody;
        sentRevisions.push(body.expectedRevision);
        if (body.expectedRevision !== revision) {
          return HttpResponse.json({ error: 'revision_mismatch', message: 'Board changed.' }, { status: 409 });
        }
        revision += 1;
        return HttpResponse.json(storedWorkBoard({ revision }));
      }),
    );
    const { client } = renderWorkBoard('?layout=board');

    await user.hover(
      await within(await columnHeader('Planning')).findByRole('link', { name: /ends when submit_plan/ }),
    );
    const steps = await screen.findByRole('list', { name: 'Planning, step by step' });
    const toggle = await within(steps).findByRole('switch', { name: 'Planning: start on its own' });
    revision = 3;
    await user.click(toggle);
    await waitForMutationsIdle(client);
    expect(await within(steps).findByText('Didn’t save, try again')).toBeVisible();

    await expect.poll(() => client.isFetching()).toBe(0);
    await user.click(toggle);
    await waitForMutationsIdle(client);
    expect(sentRevisions).toEqual([1, 3]);
  });

  it("offers no switch to someone who can't edit the board", async () => {
    const user = userEvent.setup();
    stubWorkBoard(storedCatalog);
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake-routes`, () =>
        HttpResponse.json({ intakeRoutes: [], canEdit: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, () =>
        HttpResponse.json(storedWorkBoard({}, false)),
      ),
    );
    renderWorkBoard('?layout=board');

    await user.hover(
      await within(await columnHeader('Planning')).findByRole('link', { name: /ends when submit_plan/ }),
    );
    expect(await screen.findByText('No rule moves cards here')).toBeVisible();
    expect(screen.getByText('Started by hand')).toBeVisible();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
