import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { RoutedSourcePicker } from '../IntakeSourceRouting';

const factories = [
  { id: 'fp-1', name: 'Acme' },
  { id: 'fp-2', name: 'Globex' },
];

function stub(initial: IntakeSourceBinding[]) {
  let bindings = initial;
  const saved: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.put<never, IntakeSourceBinding & { factoryProjectId: string | null }>(
      `${TEST_BASE_URL}/web/intake/bindings`,
      async ({ request }) => {
        const body = await request.json();
        saved.push(body);
        bindings = body.factoryProjectId ? [{ ...body, factoryProjectId: body.factoryProjectId }] : [];
        return HttpResponse.json({ bindings });
      },
    ),
  );
  return saved;
}

const renderRouting = () =>
  renderWithProviders(
    <RoutedSourcePicker
      integrationId="linear"
      routingLabel="Linear"
      factories={factories}
      label="Linear projects and teams"
      addLabel="Add project or team"
      groups={[{ id: 'linear', items: [{ id: 'proj-1', label: 'Releases' }] }]}
      selectedIds={['proj-1']}
      saving={false}
      onToggleItem={() => {}}
    />,
  );

describe('RoutedSourcePicker', () => {
  it('routes a selected source from its own row', async () => {
    stub([]);
    renderRouting();
    const row = await screen.findByRole('listitem');
    await waitFor(() => expect(within(row).getByRole('combobox', { name: 'Factory for Releases' })).toBeEnabled());
    expect(within(row).getByText("This source's issues won't be picked up.")).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove Releases' })).toBeInTheDocument();
  });

  it('takes a routed project as routed, with no board to choose: intake routes place its cards', async () => {
    stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1' }]);
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toHaveTextContent('Acme'));
    expect(screen.queryByRole('combobox', { name: 'Board for Releases' })).not.toBeInTheDocument();
    expect(screen.queryByText(/won't be picked up/)).not.toBeInTheDocument();
  });

  it('saves the Factory again when it is re-picked', async () => {
    const saved = stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1' }]);
    const user = userEvent.setup();
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toBeEnabled());
    await user.click(factory);
    await user.click(await screen.findByRole('option', { name: 'Acme' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ factoryProjectId: 'fp-1' });
  });

  it('moves the project to a different Factory', async () => {
    const saved = stub([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1' }]);
    const user = userEvent.setup();
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toBeEnabled());
    await user.click(factory);
    await user.click(await screen.findByRole('option', { name: 'Globex' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ factoryProjectId: 'fp-2' });
  });

  it('shows the picked Factory at once and puts the previous route back when the server refuses it', async () => {
    stub([]);
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.put(`${TEST_BASE_URL}/web/intake/bindings`, async () => {
        await gate;
        return HttpResponse.json({ error: 'factory_project_not_found' }, { status: 404 });
      }),
    );
    const user = userEvent.setup();
    renderRouting();

    const factory = await screen.findByRole('combobox', { name: 'Factory for Releases' });
    await waitFor(() => expect(factory).toBeEnabled());
    await user.click(factory);
    await user.click(await screen.findByRole('option', { name: 'Acme' }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Factory for Releases' })).toHaveTextContent('Acme'),
    );

    release();

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Factory for Releases' })).toHaveTextContent('Not routed'),
    );
  });

  it('offers a retry instead of editable routes when the routes fail to load', async () => {
    const binding = { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'fp-1' };
    stub([binding]);
    let failBindings = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
        failBindings ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ bindings: [binding] }),
      ),
    );
    const user = userEvent.setup();
    renderRouting();

    expect(await screen.findByText('Routing is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Factory for Releases' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Not routed/)).not.toBeInTheDocument();

    failBindings = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox', { name: 'Factory for Releases' })).toHaveTextContent('Acme');
  });
});
