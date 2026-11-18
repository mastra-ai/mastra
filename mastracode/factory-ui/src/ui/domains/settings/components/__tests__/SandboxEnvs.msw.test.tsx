import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { SandboxEnv, SandboxEnvList } from '../../../workspaces/services/sandbox-envs';
import { FactoryManagementSection } from '../FactoryManagementSection';
import { environmentPayload, FACTORY_ID } from './fixtures/environment';

const ENVS_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sandbox-envs`;

interface RecordedRequest {
  method: string;
  name: string;
  body: unknown;
}

function env(name: string, appliesTo: SandboxEnv['appliesTo']): SandboxEnv {
  return { name, appliesTo, updatedAt: '2026-11-09T12:00:00.000Z', updatedBy: 'user-1' };
}

/** A tiny in-memory server for the four routes; values are kept but never returned, like the real one. */
function useSandboxEnvsServer(initial: SandboxEnv[], writable = true) {
  const envs = new Map(initial.map(item => [item.name, item]));
  const requests: RecordedRequest[] = [];
  const list = (): SandboxEnvList => ({ envs: [...envs.values()], writable });
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme', repositories: [] }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`, () =>
      HttpResponse.json({ environment: environmentPayload() }),
    ),
    http.get(ENVS_URL, () => HttpResponse.json(list())),
    http.put<{ name: string }, { value: string; appliesTo: SandboxEnv['appliesTo'] }>(
      `${ENVS_URL}/:name`,
      async ({ params, request }) => {
        const body = await request.json();
        requests.push({ method: 'PUT', name: params.name, body });
        const saved = env(params.name, body.appliesTo);
        envs.set(params.name, saved);
        return HttpResponse.json({ env: saved });
      },
    ),
    http.patch<{ name: string }, { appliesTo: SandboxEnv['appliesTo'] }>(
      `${ENVS_URL}/:name`,
      async ({ params, request }) => {
        const body = await request.json();
        requests.push({ method: 'PATCH', name: params.name, body });
        const saved = env(params.name, body.appliesTo);
        envs.set(params.name, saved);
        return HttpResponse.json({ env: saved });
      },
    ),
    http.delete<{ name: string }>(`${ENVS_URL}/:name`, ({ params }) => {
      requests.push({ method: 'DELETE', name: params.name, body: null });
      envs.delete(params.name);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

function renderSettings() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/factory`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/factory" element={<FactoryManagementSection />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

async function section() {
  const heading = await screen.findByRole('heading', { name: 'Environment variables' });
  return within(heading.closest('section')!);
}

type User = ReturnType<typeof userEvent.setup>;

async function openRowAction(user: User, vars: Awaited<ReturnType<typeof section>>, name: string, action: string) {
  await user.click(await vars.findByRole('button', { name: `${name} actions` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

describe('Environment variables settings', () => {
  it('sits between Environment and Builds and lists variables in a table with masked values', async () => {
    useSandboxEnvsServer([env('DATABASE_URL', 'runtime'), env('NPM_TOKEN', 'both')]);

    renderSettings();

    const vars = await section();
    const table = await vars.findByRole('table', { name: 'Environment variables' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map(header => header.textContent);
    expect(headers).toEqual(['Name', 'Value', 'Applies to', 'Updated', 'Actions']);
    expect(within(table).getByRole('button', { name: 'About where variables apply' })).toHaveAccessibleDescription(
      /Runtime: every command in the sandbox.*Build: only the template image build/,
    );
    expect(within(table).getByText('DATABASE_URL')).toBeInTheDocument();
    expect(within(table).getByLabelText('DATABASE_URL value hidden')).toHaveTextContent('••••••••••••');
    expect(within(table).getByLabelText('NPM_TOKEN applies to')).toHaveTextContent('BuildRuntime');
    expect(within(table).getByLabelText('DATABASE_URL applies to')).toHaveTextContent('Runtime');
    expect(vars.queryByRole('button', { name: /reveal|show/i })).not.toBeInTheDocument();
    // The add form only opens from the header button.
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(headings).toEqual(['Environment', 'Environment variables', 'Builds', 'Danger zone']);
  });

  it('shows an empty state when there are no variables', async () => {
    useSandboxEnvsServer([]);

    renderSettings();

    const vars = await section();
    expect(await vars.findByText('No variables yet.')).toBeInTheDocument();
    expect(vars.queryByRole('table')).not.toBeInTheDocument();
  });

  it('adds a variable from the dialog with PUT, showing the value while typing', async () => {
    const requests = useSandboxEnvsServer([]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await user.click(await vars.findByRole('button', { name: 'Add variable' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'API_KEY');
    const valueInput = within(dialog).getByRole('textbox', { name: 'Value' });
    await user.type(valueInput, 'sk-123');
    // A textbox, not a password field: what you type is visible until it's saved.
    expect(valueInput).toHaveValue('sk-123');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Build' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests).toEqual([{ method: 'PUT', name: 'API_KEY', body: { value: 'sk-123', appliesTo: 'both' } }]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await vars.findByLabelText('API_KEY value hidden')).toHaveTextContent('••••••••••••');
    expect(screen.queryByText('sk-123')).not.toBeInTheDocument();
  });

  it('blocks adding a name that already exists and asks for at least one target', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await vars.findByText('API_KEY');
    await user.click(vars.getByRole('button', { name: 'Add variable' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'API_KEY');
    await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'v');
    expect(within(dialog).getByText('API_KEY already exists. Edit it instead.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(within(dialog).getByRole('textbox', { name: 'Name' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'OTHER');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Runtime' }));
    expect(within(dialog).getByText('Pick at least one.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(requests).toEqual([]);
  });

  it('changes where a variable applies from Edit with PATCH and no value', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await openRowAction(user, vars, 'API_KEY', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(within(dialog).getByRole('textbox', { name: 'Value' })).toHaveValue('');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Build' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Runtime' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(requests).toEqual([{ method: 'PATCH', name: 'API_KEY', body: { appliesTo: 'build' } }]));
    await waitFor(() => expect(vars.getByLabelText('API_KEY applies to')).toHaveTextContent(/^Build$/));
  });

  it('sends a new value and where it applies together with PUT, then masks it again', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await openRowAction(user, vars, 'API_KEY', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'rotated');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Build' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests).toEqual([{ method: 'PUT', name: 'API_KEY', body: { value: 'rotated', appliesTo: 'both' } }]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vars.getByLabelText('API_KEY value hidden')).toHaveTextContent('••••••••••••');
    expect(screen.queryByText('rotated')).not.toBeInTheDocument();
  });

  it('cancels an edit without sending anything', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await openRowAction(user, vars, 'API_KEY', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'draft');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests).toEqual([]);
  });

  it('deletes after confirmation', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await openRowAction(user, vars, 'API_KEY', 'Delete');
    const dialog = await screen.findByRole('alertdialog');
    expect(requests).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requests).toEqual([{ method: 'DELETE', name: 'API_KEY', body: null }]));
    await waitFor(() => expect(vars.queryByText('API_KEY')).not.toBeInTheDocument());
  });

  it('explains and disables saving when the server has no encryption key', async () => {
    useSandboxEnvsServer([env('API_KEY', 'runtime')], false);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    expect(await vars.findByText(/can't be saved until a credential encryption key is configured/)).toBeInTheDocument();
    expect(vars.getByRole('button', { name: 'Add variable' })).toBeDisabled();
    await user.click(vars.getByRole('button', { name: 'API_KEY actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    // Delete still works so old values can be removed.
    expect(screen.getByRole('menuitem', { name: 'Delete' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
