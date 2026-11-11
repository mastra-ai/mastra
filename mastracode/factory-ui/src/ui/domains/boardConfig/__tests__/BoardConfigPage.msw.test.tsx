import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { releaseBoard as releaseBoardInfo, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type {
  BoardCatalogResponse,
  FactorySkillInfo,
  FactorySkillsResponse,
  ReplaceBoardBody,
  StoredBoardInfo,
  StoredBoardResponse,
  StoredPhaseInfo,
} from '../../../../api/types';
import { createAppRoutes } from '../../../router';
import {
  BOARD_URL,
  BUILT_IN_SKILLS,
  FACTORY_ID,
  PROJECT_URL,
  renderAt,
  serveBoard,
  stubFactory,
} from './fixtures/factory-app';
import { storedWorkBoard } from './fixtures/work-board';

const EFFORT_LOW = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
} as const;

function configNav() {
  return within(screen.getByRole('navigation', { name: 'Board configuration' }));
}

async function openPhase(name: string) {
  const user = userEvent.setup();
  const nav = await screen.findByRole('navigation', { name: 'Board configuration' });
  await user.click(await within(nav).findByRole('link', { name }));
  expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue(name);
  return user;
}

const RELEASE_URL = `${PROJECT_URL}/boards/release`;
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
const releaseBoard = (board: Partial<StoredBoardInfo> = {}): StoredBoardResponse => ({
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
});

function serveCatalog() {
  server.use(
    http.get(`${PROJECT_URL}/boards`, () =>
      HttpResponse.json({ boards: [workBoardInfo, releaseBoardInfo] } satisfies BoardCatalogResponse),
    ),
  );
}

describe('Board configuration', () => {
  it('opens from the board toolbar and the sidebar row, and goes back to the board', async () => {
    stubFactory();
    serveCatalog();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/work`);

    await user.click(await screen.findByRole('link', { name: 'Configure board' }));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/config`);
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    // The sidebar lists the board's phases in place of sessions.
    expect(await configNav().findByRole('link', { name: 'Planning' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/config/planning`,
    );

    await user.click(screen.getByRole('button', { name: 'Back to Work: Board settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));

    serveBoard(releaseBoard({ source: 'app', editable: false, revision: null, codeBehaviour: {} }), RELEASE_URL);
    await user.click(await screen.findByRole('link', { name: 'Configure Release Preview' }));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/config`);
    expect(await screen.findByText("This board is defined in code, so it can't be changed here.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Release Preview: Board settings' })).toBeInTheDocument();
  });

  it('opens settings for the board in view from the Boards header, then switches to another board', async () => {
    stubFactory();
    serveCatalog();
    serveBoard(releaseBoard(), RELEASE_URL);
    const { router } = renderAt(`/factories/${FACTORY_ID}/boards/release`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'Board settings' }));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/config`);

    serveBoard(storedWorkBoard());
    await user.click(await configNav().findByRole('button', { name: 'Board: Release Preview' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Work' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/config`));
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    expect(configNav().getByRole('button', { name: 'Board: Work' })).toBeInTheDocument();
  });

  it('sends old Work board settings links to the board configuration', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`/factories/${FACTORY_ID}/settings/board`);

    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/config`);
  });

  it("lists the factory's skills no phase runs beside the board's phases, asking first about unsaved changes", async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
        HttpResponse.json({
          skills: [
            ...BUILT_IN_SKILLS,
            { name: 'configure-factory-rules', description: 'Configure rules', content: '# Rules', builtIn: true },
          ],
          canEdit: true,
        } satisfies FactorySkillsResponse),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/work/config`);

    const name = await screen.findByRole('textbox', { name: 'Board name' });
    await user.type(name, ' board');
    await user.click(configNav().getByRole('link', { name: 'Skills' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/skills`));
    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    // Each phase's skills stay on its own page.
    expect(screen.queryByText('factory-plan')).not.toBeInTheDocument();
    expect(configNav().getByRole('link', { name: 'Skills' })).toHaveAttribute('aria-current', 'page');
    expect(configNav().getByRole('link', { name: 'General' })).not.toHaveAttribute('aria-current');
    expect(configNav().getByRole('link', { name: 'Planning' })).toBeInTheDocument();
  });

  it('asks before leaving unsaved board changes for Card moves, which has no save bar', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    const { router } = renderAt(`/factories/${FACTORY_ID}/work/config`);

    await user.type(await screen.findByRole('textbox', { name: 'Board name' }), ' board');
    await user.click(configNav().getByRole('link', { name: 'Card moves' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/moves`));
  });

  it('sends old Settings › Skills links to the skills beside the Work board settings', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`/factories/${FACTORY_ID}/settings/skills`);

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/skills`);
  });

  it('lets an admin make Planning start and approve its plan on its own for effort:low cards, keeping the rest of the board as it was', async () => {
    stubFactory();
    serveBoard(storedWorkBoard({ description: 'How work moves' }));
    const saved = vi.fn<(body: ReplaceBoardBody) => void>();
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        // Read the body the way the server does.
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saved(body);
        return HttpResponse.json(storedWorkBoard({ ...body, revision: 2 }));
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Planning');
    // Factory's code depends on Planning staying a working phase, so its kind can't change.
    expect(screen.getByRole('img', { name: /^Working\./ })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Planning exit tool' })).toHaveValue('submit_plan');
    expect(screen.getByRole('textbox', { name: 'Planning session' })).toHaveValue('work');
    // Factory's code moves Planning cards to Building, so that move stays on.
    const moves = within(screen.getByRole('list', { name: 'Allowed moves from Planning' }));
    const building = moves.getByRole('button', { name: 'Building (locked)', pressed: true });
    expect(building).toHaveAttribute('aria-disabled', 'true');
    await user.click(building);
    expect(building).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(screen.getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(screen.getByLabelText('Planning: start only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));
    await user.click(screen.getByRole('switch', { name: 'Planning: approve submit_plan on its own' }));
    await user.click(screen.getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(screen.getByLabelText('Planning: approve only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));

    // The draft covers the whole board, so moving to another of its pages keeps it.
    await user.click(configNav().getByRole('link', { name: 'General' }));
    await user.clear(await screen.findByRole('textbox', { name: 'Board name' }));
    await user.type(screen.getByRole('textbox', { name: 'Board name' }), 'Delivery');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const body = saved.mock.calls[0][0];
    expect(body).toMatchObject({ name: 'Delivery', description: 'How work moves', expectedRevision: 1 });
    expect(body.phases.find(p => p.key === 'planning')).toMatchObject({
      autoStart: true,
      autoStartWhen: EFFORT_LOW,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
    });
    expect(body.phases.filter(p => p.key !== 'planning')).toEqual(
      storedWorkBoard().board.phases.filter(p => p.key !== 'planning'),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Delivery');
    expect(screen.getByText('Revision 2')).toBeInTheDocument();
  });

  it('renames a phase, changes where its cards go, and reorders the board, showing it all in the sidebar before saving', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const saved = vi.fn<(body: ReplaceBoardBody) => void>();
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        saved(body);
        return HttpResponse.json(storedWorkBoard({ ...body, revision: 2 }));
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Planning');
    const name = screen.getByRole('textbox', { name: 'Phase name' });
    await user.clear(name);
    await user.type(name, 'Plan');
    expect(await configNav().findByRole('link', { name: 'Plan' })).toBeInTheDocument();

    const moves = () => within(screen.getByRole('list', { name: 'Allowed moves from Plan' }));
    // Every other phase shows whether Plan's cards can go there; pressing one allows the move.
    const review = moves().getByRole('button', { name: 'Review', pressed: false });
    await user.click(review);
    expect(review).toHaveAttribute('aria-pressed', 'true');
    // Moves Factory's code makes stay on; the one allowed here can be turned off again.
    expect(moves().getByRole('button', { name: 'Intake (locked)' })).toHaveAttribute('aria-disabled', 'true');
    expect(review).not.toHaveAttribute('aria-disabled');
    // Triage is a stored phase, not one of Work's code phases, so its move is on but can be turned off.
    const triage = moves().getByRole('button', { name: 'Triage', pressed: true });
    expect(triage).not.toHaveAttribute('aria-disabled');

    // New cards land in the first phase, so it stays put.
    configNav().getByRole('link', { name: 'Intake' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    configNav().getByRole('link', { name: 'Review' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(await screen.findByText('Review moved to position 4 of 7.')).toBeInTheDocument();
    expect(
      configNav()
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual([
      'Skills',
      'General',
      'Card moves',
      'Intake',
      'Triage',
      'Plan',
      'Review',
      'Building',
      'Done',
      'Canceled',
    ]);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const body = saved.mock.calls[0][0];
    expect(body.phases.map(phase => phase.key)).toEqual([
      'intake',
      'triage',
      'planning',
      'pr-review',
      'execute',
      'done',
      'canceled',
    ]);
    expect(body.phases.find(phase => phase.key === 'planning')).toMatchObject({
      name: 'Plan',
      nextPhases: ['intake', 'triage', 'execute', 'pr-review', 'done', 'canceled'],
    });
  });

  it('holds back a rule the server would refuse, and shows the conflicts the server lists', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
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
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Planning');
    await user.click(screen.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(screen.getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(screen.getByLabelText('Planning: start only when JSON'));
    await user.paste('{"operator":"AND","conditions":[{"field":"item.colour","operator":"equals","value":"red"}]}');
    expect(await screen.findByText(/conditions\.0\.field: Invalid option/)).toBeInTheDocument();
    expect(screen.getByText('Fix Planning to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Planning: start only when JSON'));
    await user.paste(JSON.stringify(EFFORT_LOW));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/must stay terminal/)).toBeInTheDocument();
  });

  it("keeps a phase's unfinished JSON rule to that phase while moving between phases", async () => {
    stubFactory();
    const bugs: NonNullable<StoredPhaseInfo['autoStartWhen']> = {
      operator: 'AND',
      conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }],
    };
    const work = storedWorkBoard();
    serveBoard(
      storedWorkBoard({
        phases: work.board.phases.map(phase =>
          phase.key === 'triage' ? { ...phase, autoStart: true, autoStartWhen: bugs } : phase,
        ),
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);
    const unfinished = '{"operator":"AND","conditions":[{"field":"item.colour"';

    const user = await openPhase('Planning');
    await user.click(screen.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(screen.getAllByRole('button', { name: 'Edit as JSON' })[0]);
    await user.click(screen.getByLabelText('Planning: start only when JSON'));
    await user.paste(unfinished);
    expect(screen.getByText('Fix Planning to save.')).toBeInTheDocument();

    // Triage starts on its own too, and still shows its own rule, not Planning's text or its error.
    await user.click(configNav().getByRole('link', { name: 'Triage' }));
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triage');
    expect(screen.queryByLabelText('Triage: start only when JSON')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Edit as JSON' })[0]);
    expect(screen.getByLabelText('Triage: start only when JSON')).toHaveValue(JSON.stringify(bugs, null, 2));
    await user.click(screen.getByRole('button', { name: 'Edit as conditions' }));

    // Back on Planning, the unfinished text is still there and still holds the save.
    await user.click(configNav().getByRole('link', { name: 'Planning' }));
    expect(await screen.findByLabelText('Planning: start only when JSON')).toHaveValue(unfinished);
    expect(screen.getByText('Fix Planning to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('holds the save while a condition is half filled in, and never drops the saved rule for it', async () => {
    stubFactory();
    const bugs: NonNullable<StoredPhaseInfo['autoStartWhen']> = {
      operator: 'AND',
      conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }],
    };
    const work = storedWorkBoard();
    serveBoard(
      storedWorkBoard({
        phases: work.board.phases.map(phase =>
          phase.key === 'triage' ? { ...phase, autoStart: true, autoStartWhen: bugs } : phase,
        ),
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Triage');
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(await screen.findByText('Fix Triage to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Leaving the phase drops the half-filled row; the saved rule is still whole, so nothing is left to save.
    await user.click(configNav().getByRole('link', { name: 'Planning' }));
    await user.click(configNav().getByRole('link', { name: 'Triage' }));
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triage');
    expect(screen.getAllByRole('combobox', { name: 'Field' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it("puts a phase's saved conditions back on Discard", async () => {
    stubFactory();
    const work = storedWorkBoard();
    serveBoard(
      storedWorkBoard({
        phases: work.board.phases.map(phase =>
          phase.key === 'triage'
            ? {
                ...phase,
                autoStart: true,
                autoStartWhen: {
                  operator: 'AND',
                  conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }],
                },
              }
            : phase,
        ),
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Triage');
    const rule = screen.getByRole('group', { name: 'Triage: start only when' });
    await user.click(within(rule).getByRole('button', { name: 'Add condition' }));
    await user.click(within(rule).getAllByRole('button', { name: 'Remove condition' })[0]);
    expect(within(rule).getAllByRole('button', { name: 'Remove condition' })).toHaveLength(1);
    expect(within(rule).queryByRole('textbox', { name: 'Value' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const reloaded = await screen.findByRole('group', { name: 'Triage: start only when' });
    expect(within(reloaded).getAllByRole('button', { name: 'Remove condition' })).toHaveLength(1);
    expect(within(reloaded).getByRole('textbox', { name: 'Value' })).toHaveValue('bug');
  });

  it('asks before leaving the board with unsaved changes', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const { router } = renderAt(`/factories/${FACTORY_ID}/work/config/planning`);

    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Planning instructions' }), 'Keep plans short.');
    await user.click(screen.getByRole('button', { name: 'Back to Work: Board settings' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work/config/planning`);
    expect(screen.getByRole('textbox', { name: 'Planning instructions' })).toHaveTextContent('Keep plans short.');

    await user.click(screen.getByRole('button', { name: 'Back to Work: Board settings' }));
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard changes to Work?' })).getByRole('button', {
        name: 'Discard',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
  });

  it('resets a built-in board to its default after confirming', async () => {
    stubFactory();
    let current = storedWorkBoard({ name: 'Renamed', revision: 3 });
    serveBoard(() => current);
    const resetBodies: unknown[] = [];
    server.use(
      http.post(`${BOARD_URL}/reset`, async ({ request }) => {
        resetBodies.push(await request.json());
        current = storedWorkBoard({ revision: 4 });
        return HttpResponse.json(current);
      }),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    await user.click(await screen.findByRole('button', { name: 'Reset' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset Renamed to default?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Work'));
    expect(resetBodies).toEqual([{ expectedRevision: 3 }]);
    expect(screen.getByText('Revision 4')).toBeInTheDocument();
  });

  it('keeps a local edit when someone else changed the board, and reloads their version on request', async () => {
    stubFactory();
    let current = storedWorkBoard();
    serveBoard(() => current);
    server.use(
      http.patch(BOARD_URL, () => {
        current = storedWorkBoard({ name: 'Renamed elsewhere', revision: 2 });
        return HttpResponse.json(
          { error: 'revision_mismatch', message: 'The board changed since you loaded it.' },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    await user.clear(await screen.findByRole('textbox', { name: 'Board name' }));
    await user.type(screen.getByRole('textbox', { name: 'Board name' }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Someone else changed this board')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Mine');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Renamed elsewhere'));
    expect(screen.queryByText('Someone else changed this board')).not.toBeInTheDocument();
    expect(screen.getByText('Revision 2')).toBeInTheDocument();
  });

  it('shows the board read-only to someone who is not an organization admin', async () => {
    stubFactory();
    serveBoard(storedWorkBoard({}, false));
    renderAt(`/factories/${FACTORY_ID}/work/config/planning`);

    expect(await screen.findByText('Only organization admins can change this board.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Planning instructions' })).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByRole('switch', { name: 'Planning: start on its own' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it("edits a phase's skill in place, without touching the board draft", async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    let plan: FactorySkillInfo = {
      name: 'factory-plan',
      description: 'Plans the work',
      content: 'Write a plan.',
      builtIn: true,
    };
    const writes: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
        HttpResponse.json({ skills: [plan], canEdit: true } satisfies FactorySkillsResponse),
      ),
      http.put(`${PROJECT_URL}/skills/:name`, async ({ request }) => {
        const { content } = (await request.json()) as { content: string };
        writes.push(content);
        plan = {
          ...plan,
          description: 'Plans small work',
          edited: { updatedBy: 'user-1', updatedAt: '2026-11-09T00:00:00.000Z' },
        };
        return HttpResponse.json({ skill: plan });
      }),
    );
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    const user = await openPhase('Planning');
    expect(await screen.findByText('Plans the work')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit factory-plan' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit skill' }));
    const description = dialog.getByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'Plans small work');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('description: "Plans small work"');
    expect(await screen.findByText('Edited')).toBeInTheDocument();
    // Skill edits save on their own, so the board has nothing to save.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it("closes a phase's skill editor when going back to another phase", async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const plan: FactorySkillInfo = { name: 'factory-plan', description: 'Plans the work', content: '', builtIn: true };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/skills`, () =>
        HttpResponse.json({ skills: [plan], canEdit: true } satisfies FactorySkillsResponse),
      ),
    );
    const { router } = renderAt(`/factories/${FACTORY_ID}/work/config/triage`);
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triage');

    const user = await openPhase('Planning');
    await user.click(await screen.findByRole('button', { name: 'Edit factory-plan' }));
    expect(await screen.findByRole('dialog', { name: 'Edit skill' })).toBeInTheDocument();

    // The browser's Back button leaves the phase without closing the dialog first.
    await router.navigate(-1);
    expect(await screen.findByRole('textbox', { name: 'Phase name' })).toHaveValue('Triage');
    expect(screen.queryByRole('dialog', { name: 'Edit skill' })).not.toBeInTheDocument();
  });

  describe('a custom board', () => {
    it('saves a stored board to its own address', async () => {
      stubFactory();
      serveBoard(releaseBoard(), RELEASE_URL);
      const saved = vi.fn<(body: ReplaceBoardBody) => void>();
      server.use(
        http.patch(RELEASE_URL, async ({ request }) => {
          const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
          saved(body);
          return HttpResponse.json(releaseBoard({ ...body, revision: 4 }));
        }),
      );
      const { client } = renderAt(`/factories/${FACTORY_ID}/boards/release/config`);

      expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Release Preview');
      expect(configNav().getByRole('link', { name: 'Drafting' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/boards/release/config/drafting`,
      );

      const user = await openPhase('Drafting');
      await user.type(screen.getByRole('textbox', { name: 'Drafting instructions' }), 'Keep it short.');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitForMutationsIdle(client);

      expect(saved).toHaveBeenCalledOnce();
      const body = saved.mock.calls[0][0];
      expect(body.expectedRevision).toBe(3);
      expect(body.phases.find(phase => phase.key === 'drafting')?.runner).toEqual({
        skill: 'release-notes',
        context: 'release',
        instructions: 'Keep it short.',
      });
    });

    it('shows a board defined in app code without letting anyone change it', async () => {
      stubFactory();
      serveBoard(releaseBoard({ source: 'app', editable: false, revision: null, codeBehaviour: {} }), RELEASE_URL);
      renderAt(`/factories/${FACTORY_ID}/boards/release/config`);

      expect(
        await screen.findByText("This board is defined in code, so it can't be changed here."),
      ).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(configNav().getByRole('link', { name: 'Drafting' }));
      expect(await screen.findByRole('textbox', { name: 'Drafting instructions' })).toHaveAttribute(
        'aria-readonly',
        'true',
      );
      expect(screen.queryByRole('textbox', { name: 'Phase name' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('lists the factory skills beside a custom board', async () => {
      stubFactory();
      serveBoard(releaseBoard(), RELEASE_URL);
      const { router } = renderAt(`/factories/${FACTORY_ID}/boards/release/config`);

      const nav = within(await screen.findByRole('navigation', { name: 'Board configuration' }));
      await userEvent.setup().click(await nav.findByRole('link', { name: 'Skills' }));

      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/release/skills`);
      expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    });
  });
});
