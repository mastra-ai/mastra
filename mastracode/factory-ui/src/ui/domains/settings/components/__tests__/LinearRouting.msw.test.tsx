/**
 * BDD coverage for Linear routing: a routed project can name which installed
 * board its issues land on, and the choice travels with every binding save.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import type { LinearProject, LinearTeam } from '../../../factory/services/linear';
import { LinearRouting } from '../LinearRouting';

const projects: LinearProject[] = [{ id: 'proj-1', name: 'Releases', state: 'started', teams: [] }];
const teams: LinearTeam[] = [{ id: 'team-1', key: 'ENG', name: 'Engineering', sourceId: 'linear-team:opaque-team-1' }];
const factories = [
  { id: 'fp-1', name: 'Acme' },
  { id: 'fp-2', name: 'Globex' },
];

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
  renderWithProviders(<LinearRouting sourceIds={['proj-1']} projects={projects} teams={teams} factories={factories} />);

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

  it('drops the board when the project moves to a different Factory', async () => {
    const saved = stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1', board: 'release' }]);
    const user = userEvent.setup();
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toBeEnabled());
    await user.click(factory);
    await user.click(await screen.findByRole('option', { name: 'Globex' }));

    // A board id belongs to one Factory's catalog; carrying it over could bind
    // to a board the new Factory never installed.
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ factoryProjectId: 'fp-2', board: null });
  });

  it('renders a team source with its friendly team label', async () => {
    stub([]);
    renderWithProviders(
      <LinearRouting
        sourceIds={['linear-team:opaque-team-1']}
        projects={projects}
        teams={teams}
        factories={factories}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Factory for All issues in Engineering' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('textbox', { name: 'Search Linear routing' })).not.toBeInTheDocument();
  });

  describe('with many sources', () => {
    const manyProjects: LinearProject[] = Array.from({ length: 12 }, (_, index) => ({
      id: `proj-${index + 1}`,
      name: index === 7 ? 'Release Tools' : `Project ${index + 1}`,
      state: 'started',
      teams: [],
    }));

    const renderMany = () =>
      renderWithProviders(
        <LinearRouting
          sourceIds={manyProjects.map(project => project.id)}
          projects={manyProjects}
          teams={[]}
          factories={factories}
        />,
      );

    it('filters routing rows and shows an empty result when no project matches', async () => {
      stub([]);
      const user = userEvent.setup();
      renderMany();

      const group = await screen.findByRole('group', { name: 'Linear routing' });
      const search = screen.getByRole('textbox', { name: 'Search Linear routing' });
      expect(within(group).getAllByRole('combobox', { name: /^Factory for/ })).toHaveLength(12);

      await user.type(search, 'release');
      await waitFor(() => {
        expect(within(group).getByRole('combobox', { name: 'Factory for Release Tools' })).toBeInTheDocument();
        expect(within(group).queryByRole('combobox', { name: 'Factory for Project 1' })).not.toBeInTheDocument();
      });

      await user.clear(search);
      await user.type(search, 'no such project');
      expect(await within(group).findByText('No matches')).toBeInTheDocument();
    });

    it('shows every remaining source when the search field is hidden', async () => {
      stub([]);
      const user = userEvent.setup();
      const { rerender } = renderMany();

      await user.type(screen.getByRole('textbox', { name: 'Search Linear routing' }), 'release');
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Factory for Release Tools' })).toBeInTheDocument(),
      );

      const remainingProjects = manyProjects.slice(0, 5);
      rerender(
        <LinearRouting
          sourceIds={remainingProjects.map(project => project.id)}
          projects={manyProjects}
          teams={[]}
          factories={factories}
        />,
      );

      expect(screen.queryByRole('textbox', { name: 'Search Linear routing' })).not.toBeInTheDocument();
      const group = screen.getByRole('group', { name: 'Linear routing' });
      expect(within(group).getAllByRole('combobox', { name: /^Factory for/ })).toHaveLength(5);
      expect(within(group).getByRole('combobox', { name: 'Factory for Project 1' })).toBeInTheDocument();
    });

    it('saves the binding for a filtered project', async () => {
      const saved = stub([]);
      const user = userEvent.setup();
      renderMany();

      const search = screen.getByRole('textbox', { name: 'Search Linear routing' });
      await user.type(search, 'release');
      const factory = await screen.findByRole('combobox', { name: 'Factory for Release Tools' });
      await user.click(factory);
      await user.click(await screen.findByRole('option', { name: 'Acme' }));

      await waitFor(() =>
        expect(saved).toEqual([{ integrationId: 'linear', sourceId: 'proj-8', factoryProjectId: 'fp-1', board: null }]),
      );
    });
  });
});
