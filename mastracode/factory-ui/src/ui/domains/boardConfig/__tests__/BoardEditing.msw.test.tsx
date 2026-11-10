import { compileStoredBoard } from '@mastra/factory/boards/stored-board';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { catalogInfo, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { CreateBoardBody, ReplaceBoardBody, StoredBoardResponse } from '../../../../api/types';
import { BOARD_URL, FACTORY_ID, PROJECT_URL, renderAt, stubFactory } from './fixtures/factory-app';
import { storedWorkBoard } from './fixtures/work-board';

const notFound = () => HttpResponse.json({ error: 'board_not_found', message: 'Board not found.' }, { status: 404 });

function storedBoard(
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

/**
 * Serves a project the way the server keeps its boards: Work (unless `work` is false) plus the boards it stored,
 * which `POST …/boards` adds to and `DELETE …/boards/:key` removes from.
 */
function serveProject({ canEdit = true, work = true, stored = [] as StoredBoardResponse[] } = {}) {
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

function newBoardForm() {
  return within(screen.getByRole('form', { name: 'New board' }));
}

function configNav() {
  return within(screen.getByRole('navigation', { name: 'Board configuration' }));
}

describe('Creating a board', () => {
  it('creates a board from the starter phases under a key derived from its name, then opens its settings', async () => {
    const { created } = serveProject();
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    expect(form.getByRole('button', { name: 'Create board' })).toBeDisabled();
    await user.type(form.getByLabelText('Board name'), 'Bug Triage');
    expect(form.getByLabelText('Board key')).toHaveValue('bug-triage');
    // Cards only reach a new board through intake, which has its own settings.
    expect(form.getByRole('link', { name: 'Work Intake' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/intake`,
    );
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/bug-triage/config`),
    );
    expect(created).toHaveBeenCalledWith({
      key: 'bug-triage',
      name: 'Bug Triage',
      description: null,
      phases: [
        { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
        { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
        { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
      ],
    });
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Bug Triage');
    // The sidebar switches to the board's configuration once the new board is in the catalog.
    const nav = within(await screen.findByRole('navigation', { name: 'Board configuration' }));
    expect(await nav.findByRole('link', { name: 'Doing' })).toBeInTheDocument();
  });

  it('keeps the key as typed once it was typed by hand, and refuses keys the server would refuse', async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    const key = form.getByLabelText('Board key');
    const create = form.getByRole('button', { name: 'Create board' });
    await user.type(form.getByLabelText('Board name'), 'Bugs');

    await user.clear(key);
    await user.type(key, 'bug triage');
    expect(form.getByText(/Use letters, digits, hyphens and underscores/)).toBeInTheDocument();
    expect(create).toBeDisabled();

    await user.clear(key);
    expect(form.getByText('Enter a key.')).toBeInTheDocument();

    await user.type(key, 'work');
    expect(form.getByText('This key is already in use.')).toBeInTheDocument();
    expect(create).toBeDisabled();

    await user.clear(key);
    await user.type(key, 'bugs-board');
    await user.type(form.getByLabelText('Board name'), ' and more');
    expect(key).toHaveValue('bugs-board');
    expect(create).toBeEnabled();
  });

  it.each([
    ['reserved_board', 'review', 'Board "review" is reserved for the retired Review board.'],
    ['code_board', 'release', 'Board "release" is defined in code; it cannot be created here.'],
    ['board_exists', 'bugs', 'Board "bugs" already exists in this project.'],
  ])('shows a %s refusal on the key and keeps the form', async (error, typed, message) => {
    serveProject();
    server.use(http.post(`${PROJECT_URL}/boards`, () => HttpResponse.json({ error, message }, { status: 409 })));
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), typed);
    await user.click(form.getByRole('button', { name: 'Create board' }));

    expect(await form.findByText(message)).toBeInTheDocument();
    expect(form.getByLabelText('Board name')).toHaveValue(typed);
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/new-board`);
  });

  it('shows a refusal that is not about the key above the form', async () => {
    serveProject();
    server.use(
      http.post(`${PROJECT_URL}/boards`, () =>
        HttpResponse.json(
          { error: 'unknown_skill', message: 'Phase "doing" runs skill "missing", which is not installed.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Bugs');
    await user.click(form.getByRole('button', { name: 'Create board' }));

    const alert = await form.findByRole('alert');
    expect(alert).toHaveTextContent('The board was not created');
    expect(alert).toHaveTextContent('which is not installed');
    expect(form.queryByText('This key is already in use.')).not.toBeInTheDocument();
  });

  it("copies an existing board's phases and description", async () => {
    const bugs = storedBoard('bugs', 'Bugs', { description: 'Reported bugs' });
    const { created } = serveProject({ stored: [bugs] });
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Incidents');
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Bugs' }));
    await waitFor(() => expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Bugs'));
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(created).toHaveBeenCalledWith({
      key: 'incidents',
      name: 'Incidents',
      description: 'Reported bugs',
      phases: bugs.board.phases,
    });
  });

  it('goes back to what it started from when a copy cannot be read', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    server.use(
      http.get(`${PROJECT_URL}/boards/bugs`, () =>
        HttpResponse.json({ error: 'internal', message: 'Storage is down.' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Bugs' }));

    expect(await form.findByRole('alert')).toHaveTextContent('The board was not copied');
    expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Backlog, Doing, Done');
  });

  it('copies the Work board exactly', async () => {
    const { created } = serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    const form = within(await screen.findByRole('form', { name: 'New board' }));
    await user.type(form.getByLabelText('Board name'), 'Work two');
    await user.click(form.getByRole('combobox', { name: 'Start from' }));
    await user.click(await screen.findByRole('option', { name: 'Copy of Work' }));
    await waitFor(() => expect(form.getByRole('combobox', { name: 'Start from' })).toHaveTextContent('Work'));
    await user.click(form.getByRole('button', { name: 'Create board' }));

    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(created.mock.calls[0]?.[0]).toMatchObject({ key: 'work-two', phases: storedWorkBoard().board.phases });
  });

  it('tells a member that only admins create boards', async () => {
    serveProject({ canEdit: false });
    renderAt(`/factories/${FACTORY_ID}/new-board`);

    expect(await screen.findByText('Only organization admins can create boards.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'New board' })).not.toBeInTheDocument();
  });
});

describe("Editing a board's phases", () => {
  it('adds, retypes and removes phases, dropping moves to the removed phase, then saves', async () => {
    const { saved } = serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router, client } = renderAt(`/factories/${FACTORY_ID}/boards/bugs/config`);

    const nav = within(await screen.findByRole('navigation', { name: 'Board configuration' }));
    await user.click(await nav.findByRole('button', { name: 'Add phase' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add phase' }));
    await user.type(dialog.getByLabelText('Phase name'), 'In Review');
    expect(dialog.getByLabelText('Phase key')).toHaveValue('in-review');
    await user.click(dialog.getByRole('button', { name: 'Add phase' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/bugs/config/in-review`),
    );
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('In Review');
    await user.click(screen.getByRole('combobox', { name: 'Phase kind' }));
    await user.click(await screen.findByRole('option', { name: 'Working' }));
    expect(await screen.findByRole('textbox', { name: 'In Review session' })).toHaveValue('work');
    const moves = within(screen.getByRole('list', { name: 'Allowed moves from In Review' }));
    await user.click(moves.getByRole('button', { name: 'Fixed', pressed: false }));

    // Reported can move cards to In Review, then In Review goes away again.
    await user.click(configNav().getByRole('link', { name: 'Reported' }));
    const reportedMoves = within(await screen.findByRole('list', { name: 'Allowed moves from Reported' }));
    await user.click(reportedMoves.getByRole('button', { name: 'In Review', pressed: false }));
    await user.click(configNav().getByRole('link', { name: 'In Review' }));
    await user.click(await screen.findByRole('button', { name: 'Remove In Review' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/bugs/config`));
    expect(configNav().queryByRole('link', { name: 'In Review' })).not.toBeInTheDocument();

    // A second phase, kept this time.
    await user.click(configNav().getByRole('button', { name: 'Add phase' }));
    const second = within(await screen.findByRole('dialog', { name: 'Add phase' }));
    await user.type(second.getByLabelText('Phase name'), 'Triaged');
    await user.click(second.getByRole('button', { name: 'Add phase' }));
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triaged');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    expect(saved).toHaveBeenCalledWith('bugs', {
      name: 'Bugs',
      description: null,
      expectedRevision: 3,
      phases: [
        { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixed'] },
        { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
        { key: 'triaged', name: 'Triaged', kind: 'resting', nextPhases: [] },
      ],
    });
  });

  it("keeps the first phase's kind and only lets it go once the next phase can take new cards", async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    renderAt(`/factories/${FACTORY_ID}/boards/bugs/config/reported`);

    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Reported');
    // New cards land in the first phase, so it stays resting.
    expect(screen.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    // Fixed is terminal and can't take its place.
    expect(screen.queryByRole('button', { name: 'Remove Reported' })).not.toBeInTheDocument();
  });

  it("saves a phase's skill, goal and Factory tools", async () => {
    serveProject();
    const saves: ReplaceBoardBody[] = [];
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saves.push(body);
        return HttpResponse.json(storedWorkBoard({ ...body, revision: 2 }));
      }),
    );
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/work/config/execute`);

    const goal = await screen.findByRole('textbox', { name: 'Building goal' });
    expect(goal).not.toHaveValue('');
    await user.clear(goal);
    await user.type(goal, 'Every test passes.');
    const runs = screen.getByRole('spinbutton', { name: 'Building goal runs' });
    await user.clear(runs);
    await user.type(runs, '5');

    await user.click(configNav().getByRole('link', { name: 'Review' }));
    const verdict = await screen.findByRole('switch', { name: 'Review: Record a review verdict' });
    expect(verdict).toBeChecked();
    await user.click(verdict);

    await user.click(configNav().getByRole('link', { name: 'Triage' }));
    await user.click(await screen.findByRole('combobox', { name: 'Triage skill' }));
    await user.click(await screen.findByRole('option', { name: 'None' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    const phases = new Map(saves[0]?.phases.map(phase => [phase.key, phase]));
    expect(phases.get('execute')?.runner?.goal).toEqual({ objective: 'Every test passes.', maxRuns: 5 });
    expect(phases.get('pr-review')?.tools).toEqual(['factory_review_source']);
    expect(phases.get('triage')?.runner).toEqual({ context: 'triage' });
  });

  it('holds back goal runs the server would refuse', async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config/execute`);

    const runs = await screen.findByRole('spinbutton', { name: 'Building goal runs' });
    await user.clear(runs);
    await user.type(runs, '51');
    expect(await screen.findByText('Fix Building to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps JSON typed into a rule while moving between phases, and holds the save until it parses', async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config/planning`);

    await user.click(await screen.findByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(screen.getByRole('button', { name: 'Edit as JSON' }));
    await user.click(screen.getByLabelText('Planning: start only when JSON'));
    await user.paste('{"operator":"AND",');
    expect(await screen.findByText('Fix Planning to save.')).toBeInTheDocument();

    await user.click(configNav().getByRole('link', { name: 'Triage' }));
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triage');
    expect(screen.getByText('Fix Planning to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(configNav().getByRole('link', { name: 'Planning' }));
    expect(await screen.findByLabelText('Planning: start only when JSON')).toHaveValue('{"operator":"AND",');
  });
});

describe('Deleting a board', () => {
  it('deletes a board the project added at its revision, then shows Work', async () => {
    const { deleted } = serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/bugs/config`);

    // A board the project added has no default to go back to.
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Bugs');
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
    expect(deleted).toHaveBeenCalledWith('bugs', '3');
  });

  it('leaves a deleted board without asking about its unsaved changes', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/bugs/config`);

    const name = await screen.findByRole('textbox', { name: 'Board name' });
    await user.clear(name);
    await user.type(name, 'Bug reports{Enter}');
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stays on a board that still has cards, saying why', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    server.use(
      http.delete(`${PROJECT_URL}/boards/bugs`, () =>
        HttpResponse.json(
          { error: 'board_in_use', message: 'Board "bugs" still has 2 cards; move them off first.' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/bugs/config`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/still has 2 cards/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/bugs/config`);
  });

  it('goes to the board left when the project has no Work board, and to the factory once none are left', async () => {
    serveProject({ work: false, stored: [storedBoard('bugs', 'Bugs'), storedBoard('docs', 'Docs')] });
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/bugs/config`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/docs`));

    await router.navigate(`/factories/${FACTORY_ID}/boards/docs/config`);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Docs'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}`));
  });

  it("doesn't offer deleting a built-in board", async () => {
    serveProject();
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
