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

const skills: FactorySkillsResponse = { skills: [], canEdit: true };

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
    // What the code behaviour depends on stays read-only.
    expect(phase('Planning').getByLabelText('Exit tool')).toHaveValue('submit_plan');
    expect(phase('Planning').getByLabelText('Exit tool')).toBeDisabled();
    expect(phase('Triage').getByLabelText('Runner context')).toBeDisabled();
    // Building's code moves cards on without an exit tool, and an approved plan moves Planning to Building.
    expect(phase('Building').getByLabelText('Exit tool')).toBeDisabled();
    expect(phase('Planning').getByRole('checkbox', { name: 'Planning moves to Building' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(phase('Triage').getByText('Code behaviour')).toBeInTheDocument();
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
            message: 'Phase "planning" code handlers choose the skill; leave runner.skill unset.',
            conflicts: ['Phase "planning" code handlers choose the skill; leave runner.skill unset.'],
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
    expect(within(alert).getByText(/leave runner\.skill unset/)).toBeInTheDocument();
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
