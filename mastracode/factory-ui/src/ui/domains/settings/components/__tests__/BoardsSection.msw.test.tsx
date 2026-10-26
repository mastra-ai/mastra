/**
 * Board settings edit the project's stored boards and save the whole config back
 * through the board config endpoint, guarded by the revision they loaded.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { BoardConfigUpdateBody, StoredBoardConfig } from '../../../../../api/types';
import { BoardsSection } from '../BoardsSection';

const phase = (key: string, name: string, kind: 'resting' | 'working' | 'terminal') => ({
  key,
  name,
  description: null,
  kind,
  runner: null,
  nextPhases: null,
  exitTool: null,
  autoApproveWhen: null,
});

const stored: StoredBoardConfig = {
  revision: 3,
  updatedBy: 'u1',
  updatedAt: '2026-10-23T08:00:00.000Z',
  boards: [
    {
      id: 'b1',
      key: 'work',
      name: 'Work',
      description: null,
      phases: [
        phase('intake', 'Intake', 'resting'),
        {
          ...phase('planning', 'Planning', 'working'),
          runner: { type: 'workflow', workflowId: 'factory-plan' },
          exitTool: 'submit_plan',
        },
        { ...phase('execute', 'Building', 'working'), runner: { type: 'workflow', workflowId: 'factory-build' } },
        phase('done', 'Done', 'terminal'),
      ],
      eventRoutes: [],
    },
  ],
  intakeRoutes: [{ when: null, boardKey: 'work', phaseKey: null, enabled: true }],
};

function stub() {
  const saved: BoardConfigUpdateBody[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards/config`, () =>
      HttpResponse.json({ config: stored, runners }),
    ),
    http.put(`${TEST_BASE_URL}/web/factory/projects/:id/boards/config`, async ({ request }) => {
      const body = (await request.json()) as BoardConfigUpdateBody;
      saved.push(body);
      return HttpResponse.json({ config: { ...stored, ...body.config, revision: 4 }, runners });
    }),
  );
  return saved;
}

const runners = [
  { id: 'factory-plan', role: 'plan' },
  { id: 'factory-build', role: 'work' },
  { id: 'ops-check', role: 'work' },
];

const phaseGroup = (name: RegExp) => screen.getByRole('group', { name });

describe('BoardsSection', () => {
  it('auto-approves a phase exit from a field condition and saves it at the loaded revision', async () => {
    const saved = stub();
    const user = userEvent.setup();
    const { client } = renderWithProviders(<BoardsSection factoryId="fp-1" />);

    const planning = await screen.findByRole('group', { name: /Planning/ });
    expect(within(planning).getByText('Never — a person approves')).toBeInTheDocument();
    await user.click(within(planning).getByRole('button', { name: 'Add condition' }));

    expect(within(planning).getByRole('combobox', { name: 'Field' })).toHaveTextContent('Labels');
    expect(within(planning).getByRole('combobox', { name: 'Operator' })).toHaveTextContent('contains');
    await user.type(within(planning).getByRole('textbox', { name: 'Value' }), 'effort: low');
    await user.tab();

    await user.click(within(phaseGroup(/Planning/)).getByRole('button', { name: 'Add condition' }));
    const fields = within(phaseGroup(/Planning/)).getAllByRole('combobox', { name: 'Field' });
    await user.click(fields[1]);
    await user.click(await screen.findByRole('option', { name: 'Author' }));
    await user.type(within(phaseGroup(/Planning/)).getAllByRole('textbox', { name: 'Value' })[1], 'ward');
    await user.tab();

    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitForMutationsIdle(client);

    expect(saved).toHaveLength(1);
    expect(saved[0].expectedRevision).toBe(3);
    const planningSaved = saved[0].config.boards[0].phases[1];
    expect(planningSaved.autoApproveWhen).toEqual({
      operator: 'AND',
      conditions: [
        { field: 'item.labels', operator: 'contains', value: 'effort: low' },
        { field: 'item.author', operator: 'contains', value: 'ward' },
      ],
    });
    expect(saved[0].config.boards[0]).not.toHaveProperty('id');
  });

  it('turns a phase into an agent run with a skill, instructions and its own context', async () => {
    const saved = stub();
    const user = userEvent.setup();
    const { client } = renderWithProviders(<BoardsSection factoryId="fp-1" />);

    const building = await screen.findByRole('group', { name: /Building/ });
    await user.click(within(building).getByRole('combobox', { name: 'Runner' }));
    await user.click(await screen.findByRole('option', { name: 'Agent with skill or instructions' }));

    await user.type(within(phaseGroup(/Building/)).getByRole('textbox', { name: 'Skill (optional)' }), 'write-docs');
    await user.tab();
    await user.type(
      within(phaseGroup(/Building/)).getByRole('textbox', { name: /Instructions/ }),
      'Update the docs for this change.',
    );
    await user.tab();
    await user.type(within(phaseGroup(/Building/)).getByRole('textbox', { name: 'Context (optional)' }), 'docs');
    await user.tab();

    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitForMutationsIdle(client);

    expect(saved[0].config.boards[0].phases[2].runner).toEqual({
      type: 'agent',
      agentId: 'factory',
      skill: 'write-docs',
      instructions: 'Update the docs for this change.',
      context: 'docs',
    });
  });

  it('lets a working phase start on its own', async () => {
    const saved = stub();
    const user = userEvent.setup();
    const { client } = renderWithProviders(<BoardsSection factoryId="fp-1" />);

    const building = await screen.findByRole('group', { name: /Building/ });
    await user.click(within(building).getByRole('switch', { name: /starts on its own/ }));
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitForMutationsIdle(client);

    expect(saved[0].config.boards[0].phases[2]).toMatchObject({
      key: 'execute',
      autoStartWhen: { operator: 'AND', conditions: [] },
    });
  });

  it('offers the runners the server has, including the app’s own', async () => {
    const saved = stub();
    const user = userEvent.setup();
    const { client } = renderWithProviders(<BoardsSection factoryId="fp-1" />);

    const building = await screen.findByRole('group', { name: /Building/ });
    await user.click(within(building).getByRole('combobox', { name: 'Runner id' }));
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(
      runners.map(runner => runner.id),
    );
    await user.click(screen.getByRole('option', { name: 'ops-check' }));
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitForMutationsIdle(client);

    expect(saved[0].config.boards[0].phases[2].runner).toEqual({ type: 'workflow', workflowId: 'ops-check' });
  });
});
