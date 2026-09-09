/**
 * BDD coverage for GitHub label routing: a Factory maps issue labels onto its
 * installed custom boards, and each change is saved through the label-routes
 * endpoint (which relocates cards server-side).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeLabelRoute } from '../../../factory/services/intake';
import { GithubLabelRouting } from '../GithubLabelRouting';

function stub(initial: IntakeLabelRoute[], boards = [...builtinBoardCatalog.boards, releaseBoard]) {
  let routes = initial;
  const saved: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/label-routes`, () => HttpResponse.json({ routes })),
    http.put(`${TEST_BASE_URL}/web/intake/label-routes`, async ({ request }) => {
      const body = (await request.json()) as IntakeLabelRoute & { board: string | null };
      saved.push(body);
      const label = body.label.trim().toLowerCase();
      routes = routes.filter(route => route.label !== label);
      if (body.board) routes = [...routes, { ...body, label, board: body.board }];
      return HttpResponse.json({ routes });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () => HttpResponse.json({ boards })),
  );
  return saved;
}

const renderRouting = () =>
  renderWithProviders(
    <GithubLabelRouting factoryProjectId="fp-1" name="Acme" repositories={['acme/app', 'acme/docs']} />,
  );
const releaseRoute: IntakeLabelRoute = {
  factoryProjectId: 'fp-1',
  integrationId: 'github',
  label: 'release',
  board: 'release',
};

describe('GithubLabelRouting', () => {
  it('adds a label route offering only custom boards, never Work or Review', async () => {
    const saved = stub([]);
    const user = userEvent.setup();
    renderRouting();

    const label = await screen.findByRole('textbox', { name: 'Label for Acme' });
    // The card must say which Factory and repositories the routes govern.
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Applies to issues from acme/app, acme/docs')).toBeInTheDocument();
    const picker = screen.getByRole('combobox', { name: 'Board for new Acme label' });
    await waitFor(() => expect(picker).toBeEnabled());
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();

    await user.type(label, ' Release ');
    await user.click(picker);
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual(['No board', 'Release Preview']);
    await user.click(screen.getByRole('option', { name: 'Release Preview' }));
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    await waitFor(() =>
      expect(saved).toEqual([
        { factoryProjectId: 'fp-1', integrationId: 'github', label: 'Release', board: 'release' },
      ]),
    );
    const row = await screen.findByRole('combobox', { name: 'Board for release' });
    expect(row).toHaveTextContent('Release Preview');
    expect(label).toHaveValue('');
  });

  it('refuses a duplicate label and points at the existing row', async () => {
    stub([releaseRoute]);
    const user = userEvent.setup();
    renderRouting();

    await screen.findByRole('combobox', { name: 'Board for release' });
    await user.type(screen.getByRole('textbox', { name: 'Label for Acme' }), 'RELEASE');
    expect(screen.getByText(/already routed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('removes a route so its issues return to Work', async () => {
    const saved = stub([releaseRoute]);
    const user = userEvent.setup();
    renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Remove route for release' }));

    await waitFor(() =>
      expect(saved).toEqual([{ factoryProjectId: 'fp-1', integrationId: 'github', label: 'release', board: null }]),
    );
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Board for release' })).not.toBeInTheDocument());
  });

  it('flags a route whose board is no longer installed', async () => {
    stub([{ ...releaseRoute, board: 'gone' }]);
    renderRouting();

    const row = await screen.findByRole('combobox', { name: 'Board for release' });
    expect(row).toHaveTextContent('gone (not installed)');
    expect(screen.getByText(/is not installed; issues stay on Work/)).toBeInTheDocument();
  });

  it('explains that nothing can be routed without custom boards', async () => {
    stub([], builtinBoardCatalog.boards);
    renderRouting();

    expect(await screen.findByText(/No custom boards are installed/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Label for Acme' })).not.toBeInTheDocument();
  });

  it('reports when routes cannot be loaded instead of pretending none exist', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/label-routes`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );
    renderRouting();

    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
  });
});
