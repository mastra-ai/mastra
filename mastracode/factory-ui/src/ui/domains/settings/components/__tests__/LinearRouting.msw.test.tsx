/**
 * BDD coverage for Linear routing: a routed project can name which installed
 * board its issues land on, and the choice travels with every binding save.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import type { LinearProject } from '../../../factory/services/linear';
import { LinearRouting } from '../LinearRouting';

const projects: LinearProject[] = [{ id: 'proj-1', name: 'Releases', state: 'started', teams: [] }];
const factories = [{ id: 'fp-1', name: 'Acme' }];

function stub(initial: IntakeSourceBinding[]) {
  let bindings = initial;
  const saved: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.put(`${TEST_BASE_URL}/web/intake/bindings`, async ({ request }) => {
      const body = (await request.json()) as IntakeSourceBinding & { factoryProjectId: string | null };
      saved.push(body);
      bindings = body.factoryProjectId ? [{ ...body, factoryProjectId: body.factoryProjectId }] : [];
      return HttpResponse.json({ bindings });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () =>
      HttpResponse.json({ boards: [...builtinBoardCatalog.boards, releaseBoard] }),
    ),
  );
  return saved;
}

const renderRouting = () =>
  renderWithProviders(<LinearRouting sourceIds={['proj-1']} projects={projects} factories={factories} />);

describe('LinearRouting board target', () => {
  it('hides the board picker until the project is routed to a Factory', async () => {
    stub([]);
    renderRouting();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Factory for Releases' })).toBeEnabled());
    expect(screen.queryByRole('combobox', { name: 'Board for Releases' })).not.toBeInTheDocument();
  });

  it('asks for a board when a routed project has none, offers Work plus installed custom boards, never Review, and saves the pick', async () => {
    const saved = stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1', board: null }]);
    const user = userEvent.setup();
    renderRouting();

    const picker = await screen.findByRole('combobox', { name: 'Board for Releases' });
    await waitFor(() => expect(picker).toBeEnabled());
    expect(picker).toHaveTextContent('Choose a board');
    expect(screen.getByText(/won't be picked up until one is set/)).toBeInTheDocument();

    await user.click(picker);
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual(['No board', 'Work', 'Release Preview']);
    await user.click(screen.getByRole('option', { name: 'Release Preview' }));

    await waitFor(() =>
      expect(saved).toEqual([
        { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1', board: 'release' },
      ]),
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Board for Releases' })).toHaveTextContent('Release Preview'),
    );
  });

  it('keeps the chosen board when the Factory is re-picked', async () => {
    const saved = stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1', board: 'release' }]);
    const user = userEvent.setup();
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toBeEnabled());
    await user.click(factory);
    await user.click(await screen.findByRole('option', { name: 'Acme' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ factoryProjectId: 'fp-1', board: 'release' });
  });
});
