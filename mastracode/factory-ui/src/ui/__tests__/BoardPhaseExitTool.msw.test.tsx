/**
 * A working phase that declares an exit tool shows it in its column header
 * (board layout) and its group header (list layout), with how its success is
 * approved: by a person, on its own, or on its own for matching cards.
 */
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoard, workBoardCatalog } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import type { BoardCatalogResponse } from '../../api/types';
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

// Cards in Planning and Building keep both columns open on the built-in board.
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
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () => HttpResponse.json(catalog)),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
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
  return heading.closest<HTMLElement>('.group\\/column')!;
}

describe('Board phase exit tools', () => {
  it("shows Planning's exit tool in its column header and that a person approves it", async () => {
    stubWorkBoard(workBoardCatalog);
    renderWorkBoard('?layout=board');

    const planning = await columnHeader('Planning');
    const chip = await within(planning).findByRole('img', {
      name: 'Planning ends when submit_plan succeeds. A person approves it.',
    });
    expect(chip).toHaveTextContent('submit_plan');

    const building = await columnHeader('Building');
    expect(within(building).queryByRole('img', { name: /ends when/ })).not.toBeInTheDocument();
  });

  it('says a stored phase whose rule matches some cards is approved on its own for matching cards', async () => {
    stubWorkBoard(storedCatalog);
    renderWorkBoard('?layout=board');

    const planning = await columnHeader('Planning');
    expect(
      await within(planning).findByRole('img', {
        name: 'Planning ends when submit_plan succeeds. It is approved on its own for matching cards.',
      }),
    ).toHaveTextContent('submit_plan');
  });

  it("shows the same in the list layout's group headers", async () => {
    stubWorkBoard(workBoardCatalog);
    renderWorkBoard();

    const planning = await screen.findByTestId('board-column-planning');
    expect(
      await within(planning).findByRole('img', {
        name: 'Planning ends when submit_plan succeeds. A person approves it.',
      }),
    ).toHaveTextContent('submit_plan');
    const building = await screen.findByTestId('board-column-execute');
    expect(within(building).queryByRole('img', { name: /ends when/ })).not.toBeInTheDocument();
  });
});
