import { compileStoredBoard } from '@mastra/factory/boards/stored-board';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import type { z } from 'zod';

import { catalogInfo, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import type {
  CreateBoardBody,
  ReplaceBoardBody,
  StoredBoardInfo,
  StoredBoardResponse,
  StoredPhaseInfo,
} from '../../../../../api/types';
import { BOARD_URL, PROJECT_URL, stubFactory } from './factory-app';
import { storedWorkBoard } from './work-board';

export const RELEASE_URL = `${PROJECT_URL}/boards/release`;

const RELEASE_PHASES: StoredPhaseInfo[] = [
  { key: 'queued', name: 'Queued', kind: 'resting', nextPhases: ['drafting'] },
  {
    key: 'drafting',
    name: 'Drafting',
    kind: 'working',
    runner: { skill: 'release-notes', context: 'release' },
    nextPhases: ['published'],
  },
  { key: 'published', name: 'Published', kind: 'terminal', nextPhases: [] },
];

/** The project's stored Release Preview board, as `GET …/boards/release` returns it. */
export function releaseBoard(board: Partial<StoredBoardInfo> = {}): StoredBoardResponse {
  return {
    board: {
      key: 'release',
      name: 'Release Preview',
      description: null,
      phases: RELEASE_PHASES,
      revision: 3,
      source: 'stored',
      editable: true,
      codeBehaviour: null,
      problems: [],
      ...board,
    },
    canEdit: true,
  };
}

/** A board the project added: Reported, then Fixed, unless `extra` says otherwise. */
export function storedBoard(
  key: string,
  name: string,
  extra: Partial<StoredBoardResponse['board']> = {},
): StoredBoardResponse {
  return {
    board: {
      key,
      name,
      description: null,
      phases: [
        { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixed'] },
        { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
      ],
      revision: 3,
      source: 'stored',
      editable: true,
      codeBehaviour: null,
      problems: [],
      ...extra,
    },
    canEdit: true,
  };
}

const notFound = () => HttpResponse.json({ error: 'board_not_found', message: 'Board not found.' }, { status: 404 });

/**
 * Serves a project the way the server keeps its boards: Work (unless `work` is false) plus the boards it stored,
 * which `POST …/boards` adds to, `PATCH …/boards/:key` replaces and `DELETE …/boards/:key` removes from.
 */
export function serveProject({
  canEdit = true,
  work = true,
  stored = [],
}: { canEdit?: boolean; work?: boolean; stored?: StoredBoardResponse[] } = {}) {
  stubFactory();
  const boards = new Map(stored.map(response => [response.board.key, response]));
  const created = vi.fn<(body: CreateBoardBody) => void>();
  const saved = vi.fn<(key: string, body: ReplaceBoardBody) => void>();
  const deleted = vi.fn<(key: string, expectedRevision: string | null) => void>();
  server.use(
    http.get(`${PROJECT_URL}/intake-routes`, () => HttpResponse.json({ intakeRoutes: [], canEdit })),
    http.get(BOARD_URL, () => (work ? HttpResponse.json(storedWorkBoard({}, canEdit)) : notFound())),
    http.get(`${PROJECT_URL}/boards/:key`, ({ params }) => {
      const board = boards.get(String(params.key));
      return board ? HttpResponse.json({ ...board, canEdit }) : notFound();
    }),
    http.get(`${PROJECT_URL}/boards`, () =>
      HttpResponse.json({
        boards: [
          ...(work ? [workBoardInfo] : []),
          ...[...boards.values()].map(({ board }) => catalogInfo(compileStoredBoard(board))),
        ],
        canEdit,
      }),
    ),
    http.post(`${PROJECT_URL}/boards`, async ({ request }) => {
      const parsed = FACTORY_ROUTE_CONTRACTS.boardCreate.bodySchema.safeParse(await request.json());
      if (!parsed.success) {
        return HttpResponse.json({ error: 'invalid_board', message: parsed.error.issues[0]?.message }, { status: 422 });
      }
      created(parsed.data);
      const { key, name, description, phases } = parsed.data;
      const response = storedBoard(key, name, { description: description ?? null, phases, revision: 1 });
      boards.set(key, response);
      return HttpResponse.json(response, { status: 201 });
    }),
    http.patch(`${PROJECT_URL}/boards/:key`, async ({ params, request }) => {
      const key = String(params.key);
      const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
      saved(key, body);
      const current = boards.get(key);
      if (!current) return notFound();
      const response: StoredBoardResponse = {
        ...current,
        board: {
          ...current.board,
          name: body.name,
          description: body.description ?? null,
          phases: body.phases,
          revision: (current.board.revision ?? 0) + 1,
        },
      };
      boards.set(key, response);
      return HttpResponse.json(response);
    }),
    http.delete(`${PROJECT_URL}/boards/:key`, ({ params, request }) => {
      const key = String(params.key);
      deleted(key, new URL(request.url).searchParams.get('expectedRevision'));
      boards.delete(key);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { created, saved, deleted };
}

/** A save body as the server reads it, after the route's contract parsed it. */
export type SavedBoard = z.output<typeof FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema>;

/**
 * Takes saves of the board at `url` the way the server does: the body must pass the route's contract, and the board
 * comes back from `respond` at its next revision.
 */
export function serveSaves(url: string, respond: (body: SavedBoard) => StoredBoardResponse) {
  const saved = vi.fn<(body: SavedBoard) => void>();
  server.use(
    http.patch(url, async ({ request }) => {
      const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
      saved(body);
      return HttpResponse.json(respond(body));
    }),
  );
  return saved;
}

/** The board's phases on the canvas, top to bottom. */
export const flow = () => within(screen.getByRole('list', { name: 'Phases' }));

/** The phase names on the canvas, in board order. */
export const phaseOrder = () =>
  flow()
    .getAllByRole('article')
    .map(node => node.getAttribute('aria-label'));

/** One phase on the canvas. */
export const phaseNode = (name: string) => within(screen.getByRole('article', { name }));

/** A phase's row on the canvas: the rules into it, its node, and its session. */
export function phaseRow(name: string) {
  const row = screen.getByRole('article', { name }).closest('li');
  if (!row) throw new Error(`${name} is not on the canvas`);
  return within(row);
}

/** Selects a phase by its name on the canvas, and waits for its panel. */
export async function openPhase(name: string, user = userEvent.setup()) {
  const phases = within(await screen.findByRole('list', { name: 'Phases' }));
  await user.click(await phases.findByRole('link', { name }));
  return within(await screen.findByRole('complementary', { name }));
}
