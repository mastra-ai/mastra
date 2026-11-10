import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { compileStoredBoard } from '@mastra/factory/boards/stored-board';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { catalogInfo, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type {
  CreateBoardBody,
  FactorySkillsResponse,
  ReplaceBoardBody,
  StoredBoardResponse,
} from '../../../../../api/types';
import { BoardsSection } from '../BoardsSection';
import { storedWorkBoard } from './fixtures/work-board';

const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/boards/work`;
const CATALOG_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/boards`;
const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;
const EFFORT_LOW = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
} as const;

const skills: FactorySkillsResponse = {
  skills: ['factory-triage', 'release-notes'].map(name => ({ name, description: name, content: '' })),
  canEdit: true,
};

function serve(board: StoredBoardResponse | (() => StoredBoardResponse)) {
  const read = vi.fn<() => void>();
  server.use(
    http.get(BOARD_URL, () => {
      read();
      return HttpResponse.json(typeof board === 'function' ? board() : board);
    }),
    http.get(SKILLS_URL, () => HttpResponse.json(skills)),
    http.get(CATALOG_URL, () => HttpResponse.json({ boards: [] })),
  );
  return read;
}

/** Shows where the app is and where closing Settings would go, so a test can tell a navigation from a re-render. */
function Location() {
  const { pathname, search, state } = useLocation();
  const from = (state as { from?: { pathname: string } } | null)?.from;
  return (
    <>
      <output aria-label="Location">{`${pathname}${search}`}</output>
      <output aria-label="Closes to">{from?.pathname ?? ''}</output>
    </>
  );
}

/** `openedFrom` is the page Settings was opened from, which closing Settings returns to. */
function renderSection(search = '', openedFrom?: string) {
  return renderWithProviders(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/factories/fp-1/settings/board',
          search,
          state: openedFrom ? { from: { pathname: openedFrom, search: '', hash: '' } } : null,
        },
      ]}
    >
      <Routes>
        <Route path="/factories/:factoryId/settings/board" element={<BoardsSection factoryId="fp-1" />} />
        <Route path="*" element={null} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}

function phase(name: string) {
  return within(screen.getByRole('region', { name: `${name} phase` }));
}

describe('BoardsSection', () => {
  it("lets an admin make Planning start and approve its plan on its own for effort:low cards, and saves the board's revision", async () => {
    serve(storedWorkBoard());
    const saved = vi.fn<(body: ReplaceBoardBody) => void>();
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        // Read the body the way the server does.
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saved(body);
        return HttpResponse.json(storedWorkBoard({ name: body.name, phases: body.phases, revision: 2 }));
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('region', { name: 'Planning phase' });
    // Runners and exit tools are the project's to edit; only the moves Factory's code makes stay checked.
    expect(phase('Planning').getByLabelText('Exit tool')).toHaveValue('submit_plan');
    expect(phase('Planning').getByLabelText('Exit tool')).toBeEnabled();
    expect(phase('Triage').getByLabelText('Runner context')).toBeEnabled();
    expect(phase('Building').getByLabelText('Exit tool')).toBeEnabled();
    expect(phase('Planning').getByRole('checkbox', { name: 'Planning moves to Building' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.queryByText('Code behaviour')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(phase('Planning').getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(phase('Planning').getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(phase('Planning').getByLabelText('Planning: start only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));
    await user.click(phase('Planning').getByRole('switch', { name: 'Planning: approve submit_plan on its own' }));
    await user.click(phase('Planning').getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(phase('Planning').getByLabelText('Planning: approve only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const body = saved.mock.calls[0][0];
    expect(body.expectedRevision).toBe(1);
    expect(body.phases.find(p => p.key === 'planning')).toMatchObject({
      autoStart: true,
      autoStartWhen: EFFORT_LOW,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
    });
    // Every other phase goes back as it came.
    expect(body.phases.filter(p => p.key !== 'planning')).toEqual(
      storedWorkBoard().board.phases.filter(p => p.key !== 'planning'),
    );
    expect(await screen.findByText('Revision 2')).toBeInTheDocument();
  });

  it('holds back a rule the server would refuse, and shows the conflicts the server lists for an edit code behaviour cannot honour', async () => {
    serve(storedWorkBoard());
    server.use(
      http.patch(BOARD_URL, () =>
        HttpResponse.json(
          {
            error: 'code_behaviour',
            message: 'Phase "done" must stay terminal; its code behaviour depends on it.',
            conflicts: ['Phase "done" must stay terminal; its code behaviour depends on it.'],
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('region', { name: 'Planning phase' });
    await user.click(phase('Planning').getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(phase('Planning').getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(phase('Planning').getByLabelText('Planning: start only when JSON'));
    await user.paste('{"operator":"AND","conditions":[{"field":"item.colour","operator":"equals","value":"red"}]}');
    expect(await phase('Planning').findByText(/conditions\.0\.field: Invalid option/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // A valid rule clears the hold; what the server refuses is shown, not lost.
    await user.clear(phase('Planning').getByLabelText('Planning: start only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));
    expect(phase('Planning').queryByText(/conditions\.0\.field/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/must stay terminal/)).toBeInTheDocument();
  });

  it("saves each phase's runner skill, goal and Factory tools, and shows the goal it stored", async () => {
    let stored = storedWorkBoard();
    serve(() => stored);
    const saved = vi.fn<(body: ReplaceBoardBody) => void>();
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saved(body);
        stored = storedWorkBoard({ name: body.name, phases: body.phases, revision: 2 });
        return HttpResponse.json(stored);
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('region', { name: 'Triage phase' });
    // The seed's stored fields show as they are.
    expect(phase('Building').getByLabelText('Goal')).toHaveValue(
      storedWorkBoard().board.phases.find(p => p.key === 'execute')!.runner!.goal!.objective,
    );
    expect(phase('Review').getByRole('checkbox', { name: 'Review: Record a review verdict' })).toBeChecked();
    // The agent or a tool moves the card after the exit tool; nothing is set per phase for it.
    expect(phase('Planning').queryByRole('combobox', { name: 'Planning: after submit_plan' })).not.toBeInTheDocument();
    expect(phase('Planning').queryByRole('switch', { name: /only people move cards here/ })).not.toBeInTheDocument();

    await user.click(phase('Triage').getByRole('combobox', { name: 'Triage skill' }));
    await user.click(await screen.findByRole('option', { name: 'release-notes' }));
    await user.click(phase('Triage').getByLabelText('Goal'));
    await user.paste('Done when the card is labelled.');
    await user.type(phase('Triage').getByLabelText('Goal runs'), '3');
    await user.click(phase('Review').getByRole('checkbox', { name: 'Review: Review the source of a change request' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const phases = saved.mock.calls[0][0].phases;
    expect(phases.find(p => p.key === 'triage')?.runner).toEqual({
      skill: 'release-notes',
      context: 'triage',
      goal: { objective: 'Done when the card is labelled.', maxRuns: 3 },
    });
    expect(phases.find(p => p.key === 'planning')?.exitTool).toEqual({ id: 'submit_plan', autoApprove: false });
    expect(phases.find(p => p.key === 'pr-review')?.tools).toEqual(['factory_record_review_verdict']);
    // What the server stored comes back into the form.
    expect(await screen.findByText('Revision 2')).toBeInTheDocument();
    expect(phase('Triage').getByLabelText('Goal')).toHaveValue('Done when the card is labelled.');
    expect(phase('Triage').getByLabelText('Goal runs')).toHaveValue(3);
  });

  it('lets a board be saved after JSON that never parsed is dropped for the rule builder', async () => {
    serve(storedWorkBoard());
    const saved = vi.fn<(body: ReplaceBoardBody) => void>();
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saved(body);
        return HttpResponse.json(storedWorkBoard({ name: body.name, phases: body.phases, revision: 2 }));
      }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('region', { name: 'Planning phase' });
    await user.click(phase('Planning').getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(phase('Planning').getByRole('button', { name: 'Edit as JSON' }));
    await user.click(phase('Planning').getByLabelText('Planning: start only when JSON'));
    await user.paste('{"operator":');
    expect(await phase('Planning').findByText('Not valid JSON.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(phase('Planning').getByRole('button', { name: 'Use rule builder' }));
    expect(phase('Planning').queryByText('Not valid JSON.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0][0].phases.find(p => p.key === 'planning')).toMatchObject({ autoStart: true });
    expect(saved.mock.calls[0][0].phases.find(p => p.key === 'planning')?.autoStartWhen ?? null).toBeNull();
  });

  it('resets an edited board to its default, at the next revision', async () => {
    serve(storedWorkBoard({ revision: 3, name: 'Shipyard work' }));
    const reset = vi.fn<(body: unknown) => void>();
    server.use(
      http.post(`${BOARD_URL}/reset`, async ({ request }) => {
        reset(await request.json());
        return HttpResponse.json(storedWorkBoard({ revision: 4 }));
      }),
    );
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByLabelText('Board name')).toHaveValue('Shipyard work');
    await user.click(screen.getByRole('button', { name: 'Reset to default' }));

    await waitFor(() => expect(reset).toHaveBeenCalledWith({ expectedRevision: 3 }));
    await waitFor(() => expect(screen.getByLabelText('Board name')).toHaveValue('Work'));
    expect(screen.getByText('Revision 4')).toBeInTheDocument();
  });

  it('keeps an edit someone else overtook unsaved, and reloads the latest board on request', async () => {
    let latest = storedWorkBoard();
    const read = serve(() => latest);
    server.use(
      http.patch(BOARD_URL, () => {
        latest = storedWorkBoard({ name: 'Renamed elsewhere', revision: 2 });
        return HttpResponse.json(
          {
            error: 'revision_mismatch',
            message: 'Board "work" is at revision 2, not 1; reload it and try again.',
          },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();
    renderSection();

    const name = await screen.findByLabelText('Board name');
    await user.clear(name);
    await user.type(name, 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Someone else changed this board')).toBeInTheDocument();
    expect(screen.getByLabelText('Board name')).toHaveValue('Mine');
    expect(read).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText('Board name')).toHaveValue('Renamed elsewhere'));
    expect(screen.queryByText('Someone else changed this board')).not.toBeInTheDocument();
    expect(screen.getByText('Revision 2')).toBeInTheDocument();
  });

  it('shows the board read-only to a member who is not an admin', async () => {
    serve(storedWorkBoard({}, false));
    const saved = vi.fn<() => void>();
    server.use(
      http.patch(BOARD_URL, () => {
        saved();
        return HttpResponse.json(storedWorkBoard());
      }),
    );
    renderSection();

    expect(await screen.findByText('Only organization admins can edit boards.')).toBeInTheDocument();
    expect(screen.getByLabelText('Board name')).toBeDisabled();
    expect(phase('Planning').getByLabelText('Instructions')).toBeDisabled();
    expect(phase('Planning').getByRole('switch', { name: 'Planning: start on its own' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });

  describe('creating a board', () => {
    const bugs: StoredBoardResponse = {
      board: {
        key: 'bugs',
        name: 'Bugs',
        description: 'Reported bugs',
        phases: [
          { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
          { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
          { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
        ],
        revision: 3,
        source: 'stored',
        editable: true,
        codeBehaviour: null,
        problems: [],
      },
      canEdit: true,
    };

    /** A project holding Work and whatever a test creates, validating a new board the way the server does. */
    function serveProject({ canEdit = true, stored = [] as StoredBoardResponse[] } = {}) {
      const boards = new Map(stored.map(response => [response.board.key, response]));
      const created = vi.fn<(body: CreateBoardBody) => void>();
      server.use(
        http.get(BOARD_URL, () => HttpResponse.json(storedWorkBoard({}, canEdit))),
        http.get(`${CATALOG_URL}/:key`, ({ params }) => {
          const board = boards.get(String(params.key));
          return board
            ? HttpResponse.json({ ...board, canEdit })
            : HttpResponse.json({ error: 'board_not_found', message: 'Board not found.' }, { status: 404 });
        }),
        http.get(SKILLS_URL, () => HttpResponse.json(skills)),
        http.get(CATALOG_URL, () =>
          HttpResponse.json({
            boards: [workBoardInfo, ...[...boards.values()].map(({ board }) => catalogInfo(compileStoredBoard(board)))],
          }),
        ),
        http.post(CATALOG_URL, async ({ request }) => {
          const parsed = FACTORY_ROUTE_CONTRACTS.boardCreate.bodySchema.safeParse(await request.json());
          if (!parsed.success) {
            return HttpResponse.json(
              { error: 'invalid_board', message: parsed.error.issues[0]?.message },
              { status: 422 },
            );
          }
          created(parsed.data);
          const { key, name, description, phases } = parsed.data;
          const response: StoredBoardResponse = {
            board: {
              key,
              name,
              description: description ?? null,
              phases,
              revision: 1,
              source: 'stored',
              editable: true,
              codeBehaviour: null,
              problems: [],
            },
            canEdit: true,
          };
          boards.set(key, response);
          return HttpResponse.json(response, { status: 201 });
        }),
      );
      return created;
    }

    const location = () => screen.getByRole('status', { name: 'Location' });

    it('creates a board from the starter phases under a key derived from its name, then opens it', async () => {
      const created = serveProject();
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'New board' }));
      const form = within(screen.getByRole('region', { name: 'New board' }));
      expect(form.getByRole('button', { name: 'Create board' })).toBeDisabled();
      await user.type(form.getByLabelText('Board name'), 'Bug Triage');
      expect(form.getByLabelText('Board key')).toHaveValue('bug-triage');
      await user.type(form.getByLabelText('Board description'), 'Where bugs go');
      // Cards only reach a new board through intake, which has its own settings.
      expect(form.getByRole('link', { name: 'Work Intake' })).toHaveAttribute(
        'href',
        '/factories/fp-1/settings/intake',
      );
      await user.click(form.getByRole('button', { name: 'Create board' }));

      await waitFor(() => expect(location()).toHaveTextContent('/factories/fp-1/boards/bug-triage'));
      expect(created).toHaveBeenCalledExactlyOnceWith({
        key: 'bug-triage',
        name: 'Bug Triage',
        description: 'Where bugs go',
        phases: [
          { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
          { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
          { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
        ],
      });
    });

    it('creates a board whose phases were added, retyped, reordered and removed in the form', async () => {
      const created = serveProject();
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Docs');
      await user.type(form.getByLabelText('New phase name'), 'In Review');
      expect(form.getByLabelText('New phase key')).toHaveValue('in-review');
      await user.click(form.getByRole('button', { name: 'Add phase' }));
      await user.click(phase('In Review').getByRole('combobox', { name: 'In Review kind' }));
      await user.click(await screen.findByRole('option', { name: 'Working' }));
      await user.click(phase('In Review').getByRole('checkbox', { name: 'In Review moves to Done' }));
      await user.click(phase('Doing').getByRole('checkbox', { name: 'Doing moves to In Review' }));
      await user.click(phase('In Review').getByRole('button', { name: 'Move In Review up' }));
      // Cards start in the first phase, which stays a resting one and stays on the board.
      expect(phase('Backlog').getByRole('button', { name: 'Remove Backlog' })).toBeDisabled();
      expect(phase('Doing').getByRole('button', { name: 'Move Doing up' })).toBeDisabled();
      expect(phase('Backlog').queryByRole('combobox', { name: 'Backlog kind' })).not.toBeInTheDocument();
      await user.click(form.getByRole('button', { name: 'Create board' }));

      await waitFor(() => expect(location()).toHaveTextContent('/factories/fp-1/boards/docs'));
      expect(created.mock.calls[0][0].phases).toEqual([
        { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
        {
          key: 'doing',
          name: 'Doing',
          kind: 'working',
          runner: { context: 'work' },
          nextPhases: ['done', 'in-review'],
        },
        { key: 'in-review', name: 'In Review', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
        { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
      ]);
    });

    it('stops phases moving cards to a phase that was removed', async () => {
      const created = serveProject();
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Inbox');
      await user.click(phase('Doing').getByRole('button', { name: 'Remove Doing' }));
      await user.click(form.getByRole('button', { name: 'Create board' }));

      await waitFor(() => expect(created).toHaveBeenCalled());
      expect(created.mock.calls[0][0].phases).toEqual([
        { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: [] },
        { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
      ]);
    });

    it('refuses a key the server would refuse before sending it', async () => {
      const created = serveProject();
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Bugs');
      const key = form.getByLabelText('Board key');
      await user.clear(key);
      await user.type(key, 'bug triage');
      expect(form.getByText(/Use letters, digits, hyphens and underscores/)).toBeInTheDocument();
      expect(form.getByRole('button', { name: 'Create board' })).toBeDisabled();
      await user.clear(key);
      expect(form.getByText('Enter a key.')).toBeInTheDocument();
      // The key stays as typed: renaming the board no longer rewrites it.
      await user.type(key, 'work');
      await user.type(form.getByLabelText('Board name'), ' two');
      expect(key).toHaveValue('work');
      expect(form.getByText('This key is already in use.')).toBeInTheDocument();
      expect(form.getByRole('button', { name: 'Create board' })).toBeDisabled();
      expect(created).not.toHaveBeenCalled();
    });

    it.each([
      ['reserved_board', 'review', 'Board "review" is reserved for the retired Review board.'],
      ['code_board', 'release', 'Board "release" is defined in code; it cannot be created here.'],
      ['board_exists', 'bugs', 'Board "bugs" already exists in this project.'],
    ])('shows a %s refusal on the key and keeps the form', async (error, key, message) => {
      serveProject();
      server.use(http.post(CATALOG_URL, () => HttpResponse.json({ error, message }, { status: 409 })));
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), key);
      await user.click(form.getByRole('button', { name: 'Create board' }));

      expect(await form.findByText(message)).toBeInTheDocument();
      expect(form.getByLabelText('Board key')).toBeInvalid();
      expect(location()).toHaveTextContent('/factories/fp-1/settings/board?new=1');
      // Typing another key drops the refusal.
      await user.type(form.getByLabelText('Board key'), '-2');
      expect(form.queryByText(message)).not.toBeInTheDocument();
    });

    it('shows why the server refused a board that is not about its key', async () => {
      serveProject();
      server.use(
        http.post(CATALOG_URL, () =>
          HttpResponse.json(
            { error: 'unknown_skill', message: 'Phase "doing" names skill "gone", which is not installed.' },
            { status: 422 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Bugs');
      await user.click(form.getByRole('button', { name: 'Create board' }));

      expect(await form.findByRole('alert')).toHaveTextContent(
        'The board was not createdPhase "doing" names skill "gone", which is not installed.',
      );
      expect(form.getByLabelText('Board key')).toBeValid();
    });

    it('copies the phases and description of an existing board into the new one', async () => {
      const created = serveProject({ stored: [bugs] });
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Incidents');
      await user.click(form.getByRole('combobox', { name: 'Start from' }));
      await user.click(await screen.findByRole('option', { name: 'Copy of Bugs' }));
      await screen.findByRole('region', { name: 'Fixing phase' });
      expect(screen.queryByRole('region', { name: 'Doing phase' })).not.toBeInTheDocument();
      expect(form.getByLabelText('Board name')).toHaveValue('Incidents');
      expect(form.getByLabelText('Board description')).toHaveValue('Reported bugs');
      await user.click(form.getByRole('button', { name: 'Create board' }));

      await waitFor(() => expect(location()).toHaveTextContent('/factories/fp-1/boards/incidents'));
      expect(created).toHaveBeenCalledExactlyOnceWith({
        key: 'incidents',
        name: 'Incidents',
        description: 'Reported bugs',
        phases: bugs.board.phases,
      });
    });

    it('copies the Work board into a board the server accepts', async () => {
      const created = serveProject();
      const user = userEvent.setup();
      renderSection('?new=1');

      const form = within(await screen.findByRole('region', { name: 'New board' }));
      await user.type(form.getByLabelText('Board name'), 'Work two');
      await user.click(form.getByRole('combobox', { name: 'Start from' }));
      await user.click(await screen.findByRole('option', { name: 'Copy of Work' }));
      await screen.findByRole('region', { name: 'Planning phase' });
      await user.click(form.getByRole('button', { name: 'Create board' }));

      await waitFor(() => expect(location()).toHaveTextContent('/factories/fp-1/boards/work-two'));
      expect(created.mock.calls[0][0].phases).toEqual(storedWorkBoard().board.phases);
    });

    it('offers no way to create a board to a member who is not an admin', async () => {
      const created = serveProject({ canEdit: false });
      renderSection('?new=1');

      // The link to the form shows the Work board instead.
      expect(await screen.findByText('Only organization admins can edit boards.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'New board' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add phase' })).not.toBeInTheDocument();
      expect(created).not.toHaveBeenCalled();
    });

    describe('a board the project created', () => {
      const BUGS_URL = `${CATALOG_URL}/bugs`;

      it('is edited in the same editor, with no default to reset to', async () => {
        serveProject({ stored: [bugs] });
        const saved = vi.fn<(body: ReplaceBoardBody) => void>();
        server.use(
          http.patch(BUGS_URL, async ({ request }) => {
            const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
            saved(body);
            return HttpResponse.json({ ...bugs, board: { ...bugs.board, ...body, revision: 4 } });
          }),
        );
        const user = userEvent.setup();
        renderSection();

        // Settings lists every board of the project, Work first.
        await user.click(await screen.findByRole('combobox', { name: 'Board' }));
        await user.click(await screen.findByRole('option', { name: 'Bugs' }));
        await screen.findByRole('region', { name: 'Fixing phase' });
        expect(location()).toHaveTextContent('/factories/fp-1/settings/board?board=bugs');
        expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
        await user.type(screen.getByLabelText('New phase name'), 'Verified');
        await user.click(screen.getByRole('button', { name: 'Add phase' }));
        await user.click(phase('Fixed').getByRole('button', { name: 'Remove Fixed' }));
        await user.click(phase('Fixing').getByRole('checkbox', { name: 'Fixing moves to Verified' }));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('Revision 4')).toBeInTheDocument();
        expect(saved).toHaveBeenCalledExactlyOnceWith({
          name: 'Bugs',
          description: 'Reported bugs',
          phases: [
            { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
            { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['verified'] },
            { key: 'verified', name: 'Verified', kind: 'resting', nextPhases: [] },
          ],
          expectedRevision: 3,
        });
      });

      it('is deleted only once the admin confirms, at the revision they saw', async () => {
        serveProject({ stored: [bugs] });
        const deleted = vi.fn<(expectedRevision: string | null) => void>();
        server.use(
          http.delete(BUGS_URL, ({ request }) => {
            deleted(new URL(request.url).searchParams.get('expectedRevision'));
            return new HttpResponse(null, { status: 204 });
          }),
        );
        const user = userEvent.setup();
        renderSection('?board=bugs');

        await user.click(await screen.findByRole('button', { name: 'Delete board' }));
        const dialog = within(await screen.findByRole('alertdialog', { name: 'Delete Bugs?' }));
        await user.click(dialog.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(deleted).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Delete board' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete board' }));

        // Settings falls back to the Work board, which cannot be deleted.
        await screen.findByRole('region', { name: 'Planning phase' });
        expect(location()).toHaveTextContent(/\/factories\/fp-1\/settings\/board$/);
        expect(deleted).toHaveBeenCalledExactlyOnceWith('3');
        expect(screen.queryByRole('button', { name: 'Delete board' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument();
      });

      it('closes Settings to the Work board after deleting the board Settings was opened from', async () => {
        serveProject({ stored: [bugs] });
        server.use(http.delete(BUGS_URL, () => new HttpResponse(null, { status: 204 })));
        const user = userEvent.setup();
        renderSection('?board=bugs', '/factories/fp-1/boards/bugs');
        const closesTo = () => screen.getByRole('status', { name: 'Closes to' });

        // Opening the new-board form, backing out of it and picking a board keep the page Settings returns to.
        await user.click(await screen.findByRole('button', { name: 'New board' }));
        await user.click(
          within(await screen.findByRole('region', { name: 'New board' })).getByRole('button', { name: 'Cancel' }),
        );
        await screen.findByRole('region', { name: 'Planning phase' });
        expect(closesTo()).toHaveTextContent('/factories/fp-1/boards/bugs');
        await user.click(screen.getByRole('combobox', { name: 'Board' }));
        await user.click(await screen.findByRole('option', { name: 'Bugs' }));
        expect(closesTo()).toHaveTextContent('/factories/fp-1/boards/bugs');

        await user.click(await screen.findByRole('button', { name: 'Delete board' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete board' }));

        await screen.findByRole('region', { name: 'Planning phase' });
        expect(closesTo()).toHaveTextContent(/^\/factories\/fp-1\/work$/);
      });

      it('stays when the server refuses the delete because it still has cards', async () => {
        serveProject({ stored: [bugs] });
        server.use(
          http.delete(BUGS_URL, () =>
            HttpResponse.json(
              { error: 'board_in_use', message: 'Board "bugs" still has cards; move or delete them first.', cards: 2 },
              { status: 409 },
            ),
          ),
        );
        const user = userEvent.setup();
        renderSection('?board=bugs');

        await user.click(await screen.findByRole('button', { name: 'Delete board' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete board' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'The board was not deletedBoard "bugs" still has cards; move or delete them first.',
        );
        expect(location()).toHaveTextContent('/factories/fp-1/settings/board?board=bugs');
        expect(screen.getByLabelText('Board name')).toHaveValue('Bugs');
      });

      it('asks for a reload when someone changed the board since the admin opened it', async () => {
        let current = bugs;
        serveProject();
        server.use(
          http.get(BUGS_URL, () => HttpResponse.json(current)),
          http.delete(BUGS_URL, () => {
            current = { ...bugs, board: { ...bugs.board, name: 'Defects', revision: 4 } };
            return HttpResponse.json(
              { error: 'revision_mismatch', message: 'Board "bugs" is at revision 4, not 3; reload it and try again.' },
              { status: 409 },
            );
          }),
        );
        const user = userEvent.setup();
        renderSection('?board=bugs');

        await user.click(await screen.findByRole('button', { name: 'Delete board' }));
        await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete board' }));

        expect(await screen.findByText('Someone else changed this board')).toBeInTheDocument();
        expect(screen.getByLabelText('Board name')).toHaveValue('Bugs');
        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(screen.getByLabelText('Board name')).toHaveValue('Defects'));
        expect(screen.getByText('Revision 4')).toBeInTheDocument();
        expect(screen.queryByText('Someone else changed this board')).not.toBeInTheDocument();
      });
    });
  });
});
