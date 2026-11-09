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

async function pickAppliesTo(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('Environment variables settings', () => {
  it('sits between Environment and Builds and lists names with masked values', async () => {
    useSandboxEnvsServer([env('DATABASE_URL', 'runtime'), env('NPM_TOKEN', 'build')]);

    renderSettings();

    const vars = await section();
    expect(await vars.findByText('DATABASE_URL')).toBeInTheDocument();
    expect(vars.getByText('NPM_TOKEN')).toBeInTheDocument();
    expect(vars.getByLabelText('DATABASE_URL value hidden')).toHaveTextContent('••••••');
    expect(vars.getByRole('combobox', { name: 'Where NPM_TOKEN applies' })).toHaveTextContent('Build');
    expect(vars.getByRole('textbox', { name: 'Variable name' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(headings).toEqual(['Environment', 'Environment variables', 'Builds', 'Danger zone']);
  });

  it('adds a variable with PUT and clears the form', async () => {
    const requests = useSandboxEnvsServer([]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await user.type(await vars.findByRole('textbox', { name: 'Variable name' }), 'API_KEY');
    await user.type(vars.getByLabelText('Variable value'), 'sk-123');
    await pickAppliesTo(user, vars.getByRole('combobox', { name: 'Where the new variable applies' }), 'Both');
    await user.click(vars.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(requests).toEqual([{ method: 'PUT', name: 'API_KEY', body: { value: 'sk-123', appliesTo: 'both' } }]),
    );
    expect(await vars.findByText('API_KEY')).toBeInTheDocument();
    expect(vars.getByRole('textbox', { name: 'Variable name' })).toHaveValue('');
    expect(vars.getByLabelText('Variable value')).toHaveValue('');
  });

  it('asks before replacing an existing variable from the add form', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await vars.findByText('API_KEY');
    await user.type(vars.getByRole('textbox', { name: 'Variable name' }), 'API_KEY');
    await user.type(vars.getByLabelText('Variable value'), 'new-value');
    await user.click(vars.getByRole('button', { name: 'Add' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Replace API_KEY?')).toBeInTheDocument();
    expect(requests).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() =>
      expect(requests).toEqual([
        { method: 'PUT', name: 'API_KEY', body: { value: 'new-value', appliesTo: 'runtime' } },
      ]),
    );
  });

  it('changes where a variable applies with PATCH and no value', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await pickAppliesTo(user, await vars.findByRole('combobox', { name: 'Where API_KEY applies' }), 'Build');

    await waitFor(() => expect(requests).toEqual([{ method: 'PATCH', name: 'API_KEY', body: { appliesTo: 'build' } }]));
    await waitFor(() =>
      expect(vars.getByRole('combobox', { name: 'Where API_KEY applies' })).toHaveTextContent('Build'),
    );
  });

  it('replaces a value with PUT, never showing the old one', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'both')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    const replace = await vars.findByLabelText('Replace value of API_KEY');
    expect(replace).toHaveValue('');
    await user.type(replace, 'rotated');
    await user.click(vars.getByRole('button', { name: 'Replace' }));

    await waitFor(() =>
      expect(requests).toEqual([{ method: 'PUT', name: 'API_KEY', body: { value: 'rotated', appliesTo: 'both' } }]),
    );
    await waitFor(() => expect(replace).toHaveValue(''));
  });

  it('deletes after confirmation', async () => {
    const requests = useSandboxEnvsServer([env('API_KEY', 'runtime')]);
    const user = userEvent.setup();

    renderSettings();

    const vars = await section();
    await user.click(await vars.findByRole('button', { name: 'Delete API_KEY' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(requests).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requests).toEqual([{ method: 'DELETE', name: 'API_KEY', body: null }]));
    await waitFor(() => expect(vars.queryByText('API_KEY')).not.toBeInTheDocument());
  });

  it('explains and disables saving when the server has no encryption key', async () => {
    useSandboxEnvsServer([env('API_KEY', 'runtime')], false);

    renderSettings();

    const vars = await section();
    expect(await vars.findByText(/can't be saved until a credential encryption key is configured/)).toBeInTheDocument();
    expect(vars.getByRole('textbox', { name: 'Variable name' })).toBeDisabled();
    expect(vars.getByLabelText('Variable value')).toBeDisabled();
    expect(vars.getByLabelText('Replace value of API_KEY')).toBeDisabled();
    expect(vars.getByRole('combobox', { name: 'Where API_KEY applies' })).toBeDisabled();
    expect(vars.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
