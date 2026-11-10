import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactorySkillsResponse, ReplaceBoardBody, StoredBoardResponse } from '../../../../../api/types';
import { WorkBoardSection } from '../WorkBoardSection';
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

function phase(name: string) {
  return within(screen.getByRole('region', { name: `${name} phase` }));
}

describe('WorkBoardSection', () => {
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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

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
    renderWithProviders(<WorkBoardSection factoryId="fp-1" />);

    expect(await screen.findByText('Only organization admins can edit the Work board.')).toBeInTheDocument();
    expect(screen.getByLabelText('Board name')).toBeDisabled();
    expect(phase('Planning').getByLabelText('Instructions')).toBeDisabled();
    expect(phase('Planning').getByRole('switch', { name: 'Planning: start on its own' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });
});
