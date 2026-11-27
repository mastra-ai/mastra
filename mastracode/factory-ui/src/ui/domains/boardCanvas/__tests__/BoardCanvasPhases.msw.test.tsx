import { compileStoredBoard, storedBoardInputSchema } from '@mastra/factory/boards/stored-board';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { waitForMutationsIdle } from '../../../../../e2e/ui/render';
import {
  flow,
  openPhase,
  phaseNode,
  phaseOrder,
  serveProject,
  serveSaves,
  storedBoard,
} from '../../boardConfig/__tests__/fixtures/canvas';
import { BOARD_URL, FACTORY_ID, PROJECT_URL, renderAt } from '../../boardConfig/__tests__/fixtures/factory-app';
import { storedWorkBoard } from '../../boardConfig/__tests__/fixtures/work-board';

const BUGS_CONFIG = `/factories/${FACTORY_ID}/boards/bugs/config`;

/** Opens the instructions, goal, session and tools of the phase whose panel is open. */
async function openRuns(name: string, user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Instructions, goal, session, tools' }));
  return within(await screen.findByRole('complementary', { name: `${name} agent runs` }));
}

async function addPhase(name: string, after: string, user: UserEvent) {
  await user.click(screen.getByRole('button', { name: `Add a phase after ${after}` }));
  await user.type(screen.getByRole('textbox', { name: 'New phase name' }), `${name}{Enter}`);
  return within(await screen.findByRole('complementary', { name }));
}

describe("Editing a board's phases", () => {
  /** Opens the Bugs board and types In Review as a new phase at its end. */
  async function addInReview() {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(BUGS_CONFIG);

    await screen.findByRole('list', { name: 'Phases' });
    await user.click(screen.getByRole('button', { name: 'Add a phase after Fixed' }));
    const draft = within(screen.getByRole('form', { name: 'New phase' }));
    await user.type(draft.getByRole('textbox', { name: 'New phase name' }), 'In Review');
    return { user, router, draft };
  }

  describe('when a phase is added at the end', () => {
    it('then it takes a key from its name', async () => {
      const { draft } = await addInReview();

      expect(draft.getByRole('textbox', { name: 'New phase key' })).toHaveValue('in-review');
    });

    it('then it opens in the panel, current on the canvas', async () => {
      const { user, router } = await addInReview();

      await user.keyboard('{Enter}');

      await waitFor(() => expect(router.state.location.pathname).toBe(`${BUGS_CONFIG}/in-review`));
      expect(await screen.findByRole('complementary', { name: 'In Review' })).toBeVisible();
      expect(flow().getByRole('link', { name: 'In Review' })).toHaveAttribute('aria-current', 'true');
    });
  });

  describe('when a retyped phase another phase moves to is removed', () => {
    it('then it leaves the canvas along with the moves to it', async () => {
      const { user, router } = await addInReview();
      await user.keyboard('{Enter}');
      const review = within(await screen.findByRole('complementary', { name: 'In Review' }));
      await user.click(review.getByRole('combobox', { name: 'Phase kind' }));
      await user.click(await screen.findByRole('option', { name: /^Working/ }));
      await user.click(review.getByRole('button', { name: 'Change moves from In Review' }));
      const moves = within(await screen.findByRole('list', { name: 'Moves from In Review' }));
      await user.click(moves.getByRole('button', { name: 'Fixed', pressed: false }));
      await user.keyboard('{Escape}');
      await user.click(phaseNode('Reported').getByRole('button', { name: 'Change moves from Reported' }));
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'In Review' }));
      await user.keyboard('{Escape}');
      await waitFor(() => expect(phaseNode('Reported').getByText('In Review')).toBeInTheDocument());

      const again = await openPhase('In Review', user);
      await user.click(again.getByRole('button', { name: 'Remove In Review' }));

      await waitFor(() => expect(router.state.location.pathname).toBe(BUGS_CONFIG));
      expect(screen.queryByRole('article', { name: 'In Review' })).not.toBeInTheDocument();
      expect(phaseNode('Reported').queryByText('In Review')).not.toBeInTheDocument();
    });
  });

  describe('when a phase is added in between and the board saved', () => {
    it('then the save has the new phase in place', async () => {
      const { saved } = serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
      const user = userEvent.setup();
      const { client } = renderAt(BUGS_CONFIG);
      await screen.findByRole('list', { name: 'Phases' });

      expect((await addPhase('Triaged', 'Reported', user)).getByRole('textbox', { name: 'Phase name' })).toHaveValue(
        'Triaged',
      );
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitForMutationsIdle(client);

      expect(saved).toHaveBeenCalledWith('bugs', {
        name: 'Bugs',
        description: null,
        expectedRevision: 3,
        phases: [
          { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixed'] },
          { key: 'triaged', name: 'Triaged', kind: 'resting', nextPhases: [] },
          { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
        ],
      });
    });
  });

  it('drops a new phase on Escape, and adds a named one in place when focus leaves it', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(BUGS_CONFIG);

    await screen.findByRole('list', { name: 'Phases' });
    await user.click(screen.getByRole('button', { name: 'Add a phase after Reported' }));
    await user.type(screen.getByRole('textbox', { name: 'New phase name' }), 'Waiting{Escape}');
    expect(screen.queryByRole('form', { name: 'New phase' })).not.toBeInTheDocument();
    expect(phaseOrder()).toEqual(['Reported', 'Fixed']);

    await user.click(screen.getByRole('button', { name: 'Add a phase after Reported' }));
    await user.type(screen.getByRole('textbox', { name: 'New phase name' }), 'Waiting');
    await user.click(document.body);
    expect(phaseOrder()).toEqual(['Reported', 'Waiting', 'Fixed']);
    expect(router.state.location.pathname).toBe(BUGS_CONFIG);
  });

  it("keeps the first phase's kind and only lets it go once the next phase can take new cards", async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    renderAt(`${BUGS_CONFIG}/reported`);

    const reported = within(await screen.findByRole('complementary', { name: 'Reported' }));
    // New cards land in the first phase, so it stays resting.
    expect(reported.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    expect(reported.getByRole('img', { name: /^Resting\./ })).toBeInTheDocument();
    // Fixed is terminal and can't take its place.
    expect(reported.queryByRole('button', { name: 'Remove Reported' })).not.toBeInTheDocument();
  });

  it("saves a phase's skill, goal and Factory tools", async () => {
    serveProject();
    const saved = serveSaves(BOARD_URL, body => storedWorkBoard({ ...body, revision: 2 }));
    const user = userEvent.setup();
    const { client } = renderAt(`/factories/${FACTORY_ID}/work/config/execute`);

    await screen.findByRole('complementary', { name: 'Building' });
    const building = await openRuns('Building', user);
    const goal = building.getByRole('textbox', { name: 'Building goal' });
    expect(goal).toHaveTextContent(/\S/);
    await user.click(goal);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    await user.type(goal, 'Every test passes.');
    const runs = building.getByRole('textbox', { name: 'Pause goal after' });
    await user.clear(runs);
    await user.type(runs, '5');

    await openPhase('Review', user);
    const verdict = (await openRuns('Review', user)).getByRole('switch', { name: 'Review: Record a review verdict' });
    expect(verdict).toBeChecked();
    await user.click(verdict);

    const triage = await openPhase('Triage', user);
    await user.click(triage.getByRole('combobox', { name: 'Triage skill' }));
    await user.click(await screen.findByRole('option', { name: 'No skill' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    const phases = new Map(saved.mock.calls[0]?.[0].phases.map(phase => [phase.key, phase]));
    expect(phases.get('execute')?.runner?.goal).toEqual({ objective: 'Every test passes.', maxRuns: 5 });
    expect(phases.get('pr-review')?.tools).toEqual(['factory_review_source']);
    expect(phases.get('triage')?.runner).toEqual({ context: 'triage' });
  });

  it('holds back goal runs the server would refuse', async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config/execute`);

    await screen.findByRole('complementary', { name: 'Building' });
    const runs = (await openRuns('Building', user)).getByRole('textbox', { name: 'Pause goal after' });
    await user.clear(runs);
    await user.type(runs, '51');
    expect(await screen.findByText('Fix Building to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe("Editing a phase's outcomes", () => {
  const fixing = {
    key: 'fixing',
    name: 'Fixing',
    kind: 'working' as const,
    runner: { context: 'work' },
    nextPhases: ['reported', 'fixed'],
  };

  it('shows one outcome per move until customized, then saves the outcomes a person wrote', async () => {
    const { saved } = serveProject({
      stored: [
        storedBoard('bugs', 'Bugs', {
          phases: [
            { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
            fixing,
            { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
          ],
        }),
      ],
    });
    const user = userEvent.setup();
    const { client } = renderAt(`${BUGS_CONFIG}/fixing`);

    const panel = within(await screen.findByRole('complementary', { name: 'Fixing' }));
    const defaults = within(await panel.findByRole('list', { name: 'Fixing outcomes' }));
    expect(defaults.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'reported moves the card to Reported',
      'fixed moves the card to Fixed',
    ]);
    await user.click(panel.getByRole('button', { name: 'Customize outcomes' }));

    const key = await panel.findByRole('textbox', { name: 'Fixing outcome 2 key' });
    await user.clear(key);
    await user.type(key, 'ship');
    const label = panel.getByRole('textbox', { name: 'Fixing outcome 2 label' });
    await user.clear(label);
    await user.type(label, 'Fix shipped');
    // Point the first outcome at Fixed instead, then back, through the target picker.
    await user.click(panel.getByRole('combobox', { name: 'Fixing outcome reported goes to' }));
    await user.click(await screen.findByRole('option', { name: 'Fixed' }));
    expect(panel.getByRole('combobox', { name: 'Fixing outcome reported goes to' })).toHaveTextContent('Fixed');
    await user.click(panel.getByRole('combobox', { name: 'Fixing outcome reported goes to' }));
    await user.click(await screen.findByRole('option', { name: 'Reported' }));
    // Every move already has an outcome, so a new one reuses the first under a free key; it goes again.
    await user.click(panel.getByRole('button', { name: 'Add outcome' }));
    expect(panel.getByRole('textbox', { name: 'Fixing outcome 3 key' })).toHaveValue('reported-2');
    await user.click(panel.getByRole('button', { name: 'Remove outcome reported-2' }));
    expect(panel.queryByRole('textbox', { name: 'Fixing outcome 3 key' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    const body = saved.mock.calls[0]?.[1];
    expect(body?.phases.find(phase => phase.key === 'fixing')?.outcomes).toEqual([
      { key: 'reported', label: 'Reported', to: 'reported' },
      { key: 'ship', label: 'Fix shipped', to: 'fixed' },
    ]);
    // The board compiles the way the server will compile it.
    expect(() =>
      compileStoredBoard(storedBoardInputSchema.parse({ key: 'bugs', name: 'Bugs', phases: body?.phases })),
    ).not.toThrow();
  });

  it('drops an outcome with its move, holds back a duplicate key, and goes back to one per move', async () => {
    const { saved } = serveProject({
      stored: [
        storedBoard('bugs', 'Bugs', {
          phases: [
            { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
            {
              ...fixing,
              outcomes: [
                { key: 'ship', label: 'Fix shipped', to: 'fixed' },
                { key: 'unclear', label: 'Needs a person', to: 'reported' },
              ],
            },
            { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
          ],
        }),
      ],
    });
    const user = userEvent.setup();
    const { client } = renderAt(`${BUGS_CONFIG}/fixing`);

    const panel = within(await screen.findByRole('complementary', { name: 'Fixing' }));
    expect(await panel.findByRole('textbox', { name: 'Fixing outcome 2 key' })).toHaveValue('unclear');
    await user.click(panel.getByRole('button', { name: 'Add outcome' }));
    await user.click(panel.getByRole('button', { name: 'Change moves from Fixing' }));
    const moves = within(await screen.findByRole('list', { name: 'Moves from Fixing' }));
    await user.click(moves.getByRole('button', { name: 'Reported', pressed: true }));
    await user.keyboard('{Escape}');
    // Both outcomes going to Reported went with the move.
    expect(panel.getByRole('textbox', { name: 'Fixing outcome 1 key' })).toHaveValue('ship');
    expect(panel.queryByRole('textbox', { name: 'Fixing outcome 2 key' })).not.toBeInTheDocument();

    await user.click(panel.getByRole('button', { name: 'Add outcome' }));
    const key = panel.getByRole('textbox', { name: 'Fixing outcome 2 key' });
    await user.clear(key);
    await user.type(key, 'ship');
    expect(panel.getAllByText('This key is already in use.')).toHaveLength(2);
    expect(await screen.findByText('Fix Fixing to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(panel.getByRole('button', { name: 'Use one per move' }));
    expect(panel.getByRole('button', { name: 'Customize outcomes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    expect(saved.mock.calls[0]?.[1].phases.find(phase => phase.key === 'fixing')).toEqual({
      ...fixing,
      nextPhases: ['fixed'],
      outcomes: null,
    });
  });

  it("says which outcome the exit tool's success reports, warns when none is picked, and customizes at most 20", async () => {
    const extra = Array.from({ length: 21 }, (_, index) => ({
      key: `step-${index + 1}`,
      name: `Step ${index + 1}`,
      kind: 'working' as const,
      runner: { context: 'work' },
      nextPhases: ['fixed'],
    }));
    const { saved } = serveProject({
      stored: [
        storedBoard('bugs', 'Bugs', {
          phases: [
            { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
            {
              ...fixing,
              nextPhases: ['reported', 'fixed', ...extra.map(phase => phase.key)],
              exitTool: { id: 'submit_plan' },
            },
            ...extra,
            { key: 'fixed', name: 'Fixed', kind: 'terminal', nextPhases: [] },
          ],
        }),
      ],
    });
    const user = userEvent.setup();
    const { client } = renderAt(`${BUGS_CONFIG}/fixing`);

    const panel = within(await screen.findByRole('complementary', { name: 'Fixing' }));
    // 21 moves into working phases, so the defaults pick no outcome for the exit tool.
    expect(await panel.findByText(/no outcome is picked, so the card waits for the agent/)).toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'Customize outcomes' }));
    expect(panel.getByRole('textbox', { name: 'Fixing outcome 20 key' })).toBeInTheDocument();
    expect(panel.queryByRole('textbox', { name: 'Fixing outcome 21 key' })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Add outcome' })).not.toBeInTheDocument();

    const key = panel.getByRole('textbox', { name: 'Fixing outcome 3 key' });
    await user.clear(key);
    await user.type(key, 'advance');
    expect(panel.queryByText(/no outcome is picked/)).not.toBeInTheDocument();
    expect(panel.getByText(/succeeds, it reports/)).toHaveTextContent(
      'When submit_plan succeeds, it reports advance, moving the card to Step 1.',
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);
    expect(saved.mock.calls[0]?.[1].phases.find(phase => phase.key === 'fixing')?.outcomes).toHaveLength(20);
  });
});

describe('Deleting a board', () => {
  const deleteBoard = async (user: UserEvent) => {
    await user.click(await screen.findByRole('button', { name: 'Board actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete board' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  };

  it('deletes a board the project added at its revision, then shows Work', async () => {
    const { deleted } = serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(BUGS_CONFIG);

    // A board the project added has no default to go back to.
    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Bugs');
    await user.click(screen.getByRole('button', { name: 'Board actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete board' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Reset to default' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Delete board' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
    expect(deleted).toHaveBeenCalledWith('bugs', '3');
  });

  it('leaves a deleted board without asking about its unsaved changes', async () => {
    serveProject({ stored: [storedBoard('bugs', 'Bugs')] });
    const user = userEvent.setup();
    const { router } = renderAt(BUGS_CONFIG);

    const name = await screen.findByRole('textbox', { name: 'Board name' });
    await user.clear(name);
    await user.type(name, 'Bug reports{Enter}');
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
    await deleteBoard(user);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`));
    // Only the delete confirmation was shown, now closing; nothing asked about the unsaved name.
    expect(screen.queryByRole('alertdialog', { name: /^Discard changes/ })).not.toBeInTheDocument();
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
    const { router } = renderAt(BUGS_CONFIG);

    await deleteBoard(user);
    expect(await screen.findByText(/still has 2 cards/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(BUGS_CONFIG);
  });

  it('goes to the board left when the project has no Work board, and to the factory once none are left', async () => {
    serveProject({ work: false, stored: [storedBoard('bugs', 'Bugs'), storedBoard('docs', 'Docs')] });
    const user = userEvent.setup();
    const { router } = renderAt(BUGS_CONFIG);

    await deleteBoard(user);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/boards/docs`));

    await router.navigate(`/factories/${FACTORY_ID}/boards/docs/config`);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Docs'));
    await deleteBoard(user);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}`));
  });

  it("doesn't offer deleting a built-in board", async () => {
    serveProject();
    const user = userEvent.setup();
    renderAt(`/factories/${FACTORY_ID}/work/config`);

    expect(await screen.findByRole('textbox', { name: 'Board name' })).toHaveValue('Work');
    await user.click(screen.getByRole('button', { name: 'Board actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Reset to default' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete board' })).not.toBeInTheDocument();
  });
});
