import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import type { BoundFunctions, queries } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { waitForMutationsIdle } from '../../../../../e2e/ui/render';
import { openPhase, phaseNode, phaseOrder, serveSaves } from '../../boardConfig/__tests__/fixtures/canvas';
import {
  BOARD_URL,
  FACTORY_ID,
  renderAt,
  serveBoard,
  stubFactory,
} from '../../boardConfig/__tests__/fixtures/factory-app';
import { storedWorkBoard } from '../../boardConfig/__tests__/fixtures/work-board';
import type { CardRule } from '../../boardConfig/boardDraft';

const CONFIG = `/factories/${FACTORY_ID}/work/config`;

const EFFORT_LOW: CardRule = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'equals', value: 'effort:low' }],
};
const BUGS: CardRule = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }],
};

/** Work, with one phase starting on its own for the cards `when` lets through. */
function workStarting(key: string, when: CardRule) {
  return storedWorkBoard({
    phases: storedWorkBoard().board.phases.map(phase =>
      phase.key === key ? { ...phase, autoStart: true, autoStartWhen: when } : phase,
    ),
  });
}

const saveWork = () => serveSaves(BOARD_URL, body => storedWorkBoard({ ...body, revision: 2 }));
/** One titled section of a phase's panel: "Starts", "Ends", "Allowed moves". */
const region = (panel: BoundFunctions<typeof queries>, name: string) => within(panel.getByRole('region', { name }));

/** Adds "Labels is `label`" to the rule in `scope`. */
async function addLabel(scope: BoundFunctions<typeof queries>, label: string, user: UserEvent) {
  await user.click(scope.getByRole('button', { name: 'Add condition' }));
  await user.click(scope.getByRole('combobox', { name: 'Field' }));
  await user.click(await screen.findByRole('option', { name: 'Labels' }));
  await user.type(scope.getByRole('textbox', { name: 'Value' }), label);
}

describe("A phase's moves on the canvas", () => {
  it('opens the move picker of a phase below the first with a click', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    renderAt(CONFIG);

    await user.click(await screen.findByRole('button', { name: 'Change moves from Planning' }));
    const menu = within(await screen.findByRole('menu'));
    expect(menu.getByText('Cards can move to')).toBeInTheDocument();
    expect(menu.getByRole('menuitemcheckbox', { name: 'Review' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Editing a board on the canvas', () => {
  it('lets an admin make Planning start and approve its plan on its own for effort:low cards, keeping the rest of the board as it was', async () => {
    stubFactory();
    serveBoard(storedWorkBoard({ description: 'How work moves' }));
    const saved = saveWork();
    const user = userEvent.setup();
    renderAt(CONFIG);

    const planning = await openPhase('Planning', user);
    expect(planning.getByRole('img', { name: /^Working\./ })).toBeInTheDocument();
    expect(planning.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    expect(planning.getByRole('textbox', { name: 'Planning exit tool' })).toHaveValue('submit_plan');

    const starts = region(planning, 'Starts');
    await user.click(starts.getByRole('switch', { name: 'Planning: start on its own' }));
    await addLabel(starts, 'effort:low', user);
    const ends = region(planning, 'Ends');
    await user.click(ends.getByRole('switch', { name: 'Planning: approve submit_plan on its own' }));
    await addLabel(ends, 'effort:low', user);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(planning.getByRole('button', { name: 'Close Planning' }));
    const name = await screen.findByRole('textbox', { name: 'Board name' });
    await user.clear(name);
    await user.type(name, 'Delivery');
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
  });

  it('renames a phase, changes where its cards go, and reorders the board, showing it all on the canvas before saving', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const saved = saveWork();
    const user = userEvent.setup();
    renderAt(CONFIG);

    const planning = await openPhase('Planning', user);
    const name = planning.getByRole('textbox', { name: 'Phase name' });
    await user.clear(name);
    await user.type(name, 'Plan');
    expect(await screen.findByRole('article', { name: 'Plan' })).toBeInTheDocument();

    phaseNode('Plan').getByRole('button', { name: 'Change moves from Plan' }).focus();
    await user.keyboard('{Enter}');
    const menu = within(await screen.findByRole('menu'));
    expect(menu.getByRole('menuitemcheckbox', { name: /^Intake/ })).toHaveAttribute('aria-disabled', 'true');
    expect(menu.getByRole('menuitemcheckbox', { name: 'Triage' })).toHaveAttribute('aria-checked', 'true');
    const review = menu.getByRole('menuitemcheckbox', { name: 'Review' });
    expect(review).toHaveAttribute('aria-checked', 'false');
    await user.click(review);
    await waitFor(() =>
      expect(screen.getByRole('menuitemcheckbox', { name: 'Review' })).toHaveAttribute('aria-checked', 'true'),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(phaseNode('Plan').getByText('Review')).toBeInTheDocument();

    // The first phase stays first; any other moves a row at a time.
    expect(screen.getByRole('link', { name: 'Intake' })).not.toHaveAttribute('aria-description');
    screen.getByRole('link', { name: 'Intake' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    const reviewPhase = screen.getByRole('link', { name: 'Review' });
    expect(reviewPhase).toHaveAttribute('aria-description', 'Alt+Up or Alt+Down moves this phase.');
    reviewPhase.focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(phaseOrder()).toEqual(['Intake', 'Triage', 'Plan', 'Review', 'Building', 'Done', 'Canceled']);
    expect(screen.getByText('Review moved to position 4 of 7.')).toBeInTheDocument();

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
    serveBoard(
      workStarting('planning', {
        operator: 'AND',
        conditions: [{ field: 'item.colour', operator: 'equals', value: 'red' }],
      }),
    );
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
    renderAt(CONFIG);

    await openPhase('Planning', user);
    await user.click(screen.getByRole('button', { name: 'Close Planning' }));
    await user.type(await screen.findByRole('textbox', { name: 'Board name' }), ' board');
    expect(screen.getByText('Fix Planning to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    const starts = region(await openPhase('Planning', user), 'Starts');
    await user.click(starts.getByRole('button', { name: /^Edit condition/ }));
    await user.click(starts.getByRole('button', { name: 'Remove condition' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/The board was not saved\..*must stay terminal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('holds the save while a condition is half filled in, and never drops the saved rule for it', async () => {
    stubFactory();
    serveBoard(workStarting('triage', BUGS));
    const user = userEvent.setup();
    renderAt(CONFIG);

    const starts = region(await openPhase('Triage', user), 'Starts');
    await user.click(starts.getByRole('button', { name: 'Add condition' }));
    expect(await screen.findByText('Fix Triage to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await openPhase('Planning', user);
    const again = region(await openPhase('Triage', user), 'Starts');
    expect(again.getAllByRole('button', { name: /^Edit condition/ })).toHaveLength(1);
    expect(again.queryByRole('combobox', { name: 'Field' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('saves a typed condition value without leaving the field first, and warns before a reload drops it', async () => {
    stubFactory();
    serveBoard(
      workStarting('pr-review', {
        operator: 'AND',
        conditions: [{ field: 'pullRequest.trusted', operator: 'equals', value: true }],
      }),
    );
    const saved = saveWork();
    const user = userEvent.setup();
    const { client } = renderAt(CONFIG);

    const starts = region(await openPhase('Review', user), 'Starts');
    await user.click(starts.getByRole('button', { name: /^Edit condition/ }));
    await user.click(starts.getByRole('combobox', { name: 'Field' }));
    await user.click(await screen.findByRole('option', { name: 'Labels' }));
    await user.type(starts.getByRole('textbox', { name: 'Value' }), 'AUTO LINE');

    // Still typing: a browser doesn't move focus to a disabled button, so Save has to be ready now.
    expect(starts.getByRole('textbox', { name: 'Value' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    const reload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reload);
    expect(reload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(saved.mock.calls[0][0].phases.find(phase => phase.key === 'pr-review')).toMatchObject({
      autoStart: true,
      autoStartWhen: {
        operator: 'AND',
        conditions: [{ field: 'item.labels', operator: 'equals', value: 'AUTO LINE' }],
      },
    });
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    const afterSave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it('puts the value from before typing back on Escape', async () => {
    stubFactory();
    serveBoard(
      workStarting('pr-review', {
        operator: 'AND',
        conditions: [{ field: 'item.labels', operator: 'equals', value: 'AUTO LINE' }],
      }),
    );
    const user = userEvent.setup();
    renderAt(CONFIG);

    const starts = region(await openPhase('Review', user), 'Starts');
    await user.click(starts.getByRole('button', { name: /^Edit condition/ }));
    const value = starts.getByRole('textbox', { name: 'Value' });
    await user.clear(value);
    await user.type(value, 'OTHER');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(starts.getByRole('button', { name: /^Edit condition: .*AUTO LINE/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it("puts a phase's saved conditions back on Discard", async () => {
    stubFactory();
    serveBoard(workStarting('triage', BUGS));
    const user = userEvent.setup();
    renderAt(CONFIG);

    const rule = within(region(await openPhase('Triage', user), 'Starts').getByRole('group', { name: 'Only when' }));
    await user.click(rule.getByRole('button', { name: /^Edit condition/ }));
    await user.click(rule.getByRole('button', { name: 'Remove condition' }));
    expect(rule.queryByRole('button', { name: /^Edit condition/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const reloaded = within(
      await within(await screen.findByRole('region', { name: 'Starts' })).findByRole('group', { name: 'Only when' }),
    );
    expect(reloaded.getByRole('button', { name: /^Edit condition: .*bug/ })).toBeInTheDocument();
  });
});

describe('The board as a whole', () => {
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
    renderAt(CONFIG);

    await user.click(await screen.findByRole('button', { name: 'Board actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reset to default' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset Renamed to default?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Work'));
    expect(resetBodies).toEqual([{ expectedRevision: 3 }]);
  });

  it('keeps a local edit when someone else changed the board, and reloads their version on request', async () => {
    stubFactory();
    let current = storedWorkBoard();
    serveBoard(() => current);
    const savedRevisions: unknown[] = [];
    server.use(
      http.patch(BOARD_URL, async ({ request }) => {
        const body = FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema.parse(await request.json());
        savedRevisions.push(body.expectedRevision);
        if (body.expectedRevision === 2) return HttpResponse.json(storedWorkBoard({ name: 'Mine again', revision: 3 }));
        current = storedWorkBoard({ name: 'Renamed elsewhere', revision: 2 });
        return HttpResponse.json(
          { error: 'revision_mismatch', message: 'The board changed since you loaded it.' },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();
    renderAt(CONFIG);

    await user.clear(await screen.findByRole('textbox', { name: 'Board name' }));
    await user.type(screen.getByRole('textbox', { name: 'Board name' }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Someone else changed this board')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Mine');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveValue('Renamed elsewhere'));
    expect(screen.queryByText('Someone else changed this board')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Board name' }));
    await user.type(screen.getByRole('textbox', { name: 'Board name' }), 'Mine again');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedRevisions).toEqual([1, 2]));
  });

  it('holds the save until the board has a name', async () => {
    stubFactory();
    serveBoard(storedWorkBoard());
    const user = userEvent.setup();
    renderAt(CONFIG);

    const description = await screen.findByRole('textbox', { name: 'Board description' });
    await user.type(description, 'How work moves');
    await user.clear(screen.getByRole('textbox', { name: 'Board name' }));
    expect(await screen.findByText('Name the board to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
