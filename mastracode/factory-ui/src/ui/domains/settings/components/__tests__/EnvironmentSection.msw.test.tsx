import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { EnvironmentSection } from '../EnvironmentSection';
import { environmentPayload, environmentRepository, FACTORY_ID } from './fixtures/environment';

const ENVIRONMENT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`;

function useFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] }),
    ),
  );
}

function useEnvironment(environment: FactoryEnvironmentPayload) {
  server.use(http.get(ENVIRONMENT_URL, () => HttpResponse.json({ environment })));
}

/** Records every PATCH body and answers with the given environment. */
function recordPatches(environment: FactoryEnvironmentPayload) {
  const patches: FactoryEnvironmentPatch[] = [];
  server.use(
    http.patch(ENVIRONMENT_URL, async ({ request }) => {
      patches.push((await request.json()) as FactoryEnvironmentPatch);
      return HttpResponse.json({ environment });
    }),
  );
  return patches;
}

function renderEnvironmentSettings() {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/environment`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/environment" element={<EnvironmentSection />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

describe('Environment settings', () => {
  it('renders the section for the factory with its environment', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Environment' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace setup' })).toBeInTheDocument();
  });

  it('points to Repositories when nothing is linked yet', async () => {
    useFactory();
    useEnvironment(environmentPayload({ repositories: [] }));

    renderEnvironmentSettings();

    expect(await screen.findByText(/Link a repository first/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Repositories' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/repositories`,
    );
  });

  it('shows the load failure instead of an empty page', async () => {
    useFactory();
    server.use(http.get(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderEnvironmentSettings();

    expect(await screen.findByText('Failed to load environment (500)')).toBeInTheDocument();
  });

  it('shows every stored value: resources, ordered repositories with status, workspace setup', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
        sandboxIdleTimeoutMinutes: null,
        workspaceSetupCommand: 'pnpm install',
        repositories: [
          environmentRepository({
            projectRepositoryId: 'link-api',
            position: 2,
            lastBuildStatus: 'failed',
            lastBuildError: 'pnpm build exited with 1',
            setupCommand: 'pnpm build',
          }),
          environmentRepository({ projectRepositoryId: 'link-web', position: 1, lastBuildStatus: 'configured' }),
          environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 3, inEnvironment: false }),
        ],
      }),
    );

    renderEnvironmentSettings();

    expect(await screen.findByRole('spinbutton', { name: 'CPU cores' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Memory in megabytes' })).toHaveValue(4096);
    expect(screen.getByRole('spinbutton', { name: 'Idle timeout in minutes' })).toHaveValue(null);
    expect(screen.getByRole('textbox', { name: 'Working directory' })).toHaveValue('/workspace');
    expect(screen.getByRole('textbox', { name: 'Workspace setup command' })).toHaveValue('pnpm install');

    // Rows follow `position`; a link whose repository is gone is not shown at all.
    const names = screen.getAllByText(/^acme\//).map(node => node.textContent);
    expect(names).toEqual(['acme/link-web', 'acme/link-api']);
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('switch', { name: /Include .* in the environment/ })).toHaveLength(2);
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('Last build failed')).toBeInTheDocument();
    expect(screen.queryByText('Unbuilt')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Include acme/link-web in the environment' })).toBeChecked();

    expect(screen.queryByText('pnpm build exited with 1')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show details for acme/link-api' }));
    expect(screen.getByText('pnpm build exited with 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Setup command for acme/link-api' })).toHaveValue('pnpm build');
  });

  it('offers a drag handle per live repository and none for a dead link', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
        repositories: [
          environmentRepository({ projectRepositoryId: 'link-web', position: 1 }),
          environmentRepository({ projectRepositoryId: 'link-api', position: 2 }),
          environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 3 }),
        ],
      }),
    );

    renderEnvironmentSettings();

    // Drag and drop itself needs layout jsdom does not provide; the PATCH a drop
    // produces is covered by `repositoriesPatch`'s unit test.
    expect(await screen.findByLabelText('Drag acme/link-web')).toBeInTheDocument();
    expect(screen.getByLabelText('Drag acme/link-api')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Drag /)).toHaveLength(2);
  });

  it('clears a resource back to the provider default and renders it as an empty field', async () => {
    useFactory();
    const environment = environmentPayload({ sandboxMemoryMb: null });
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const memory = await screen.findByRole('spinbutton', { name: 'Memory in megabytes' });
    expect(memory).toHaveValue(null);
    expect(memory).toHaveAttribute('placeholder', 'default');

    const cpu = screen.getByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ sandboxCpuCount: null });
  });

  it('toggles a repository out of the environment', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);

    renderEnvironmentSettings();

    await userEvent.setup().click(await screen.findByRole('switch', { name: 'Include acme/api in the environment' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.repositories).toEqual([
      { projectRepositoryId: 'link-web', position: 1, inEnvironment: true, setupCommand: null, teardownCommand: null },
      { projectRepositoryId: 'link-api', position: 2, inEnvironment: false, setupCommand: null, teardownCommand: null },
    ]);
  });

  it('saves a setup command inside the repositories array', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.click(await screen.findByRole('button', { name: 'Show details for acme/web' }));
    const input = screen.getByRole('textbox', { name: 'Setup command for acme/web' });
    await user.type(input, 'pnpm i{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.repositories?.[0]).toMatchObject({ projectRepositoryId: 'link-web', setupCommand: 'pnpm i' });
    expect(patches[0]?.repositories?.[1]).toMatchObject({ projectRepositoryId: 'link-api', setupCommand: null });
  });

  it('patches one resource field at a time', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.type(cpu, '4{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ sandboxCpuCount: 4 });

    const idle = screen.getByRole('spinbutton', { name: 'Idle timeout in minutes' });
    await user.clear(idle);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ sandboxIdleTimeoutMinutes: null });
  });

  it('rejects a non-integer or out-of-range number without a PATCH', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.type(cpu, '1.5{Enter}');
    expect(await screen.findByText('Enter a whole number between 1 and 64')).toBeInTheDocument();
    expect(cpu).toHaveValue(2);

    await user.clear(cpu);
    await user.type(cpu, '99{Enter}');
    await waitFor(() => expect(screen.getAllByText('Enter a whole number between 1 and 64').length).toBeGreaterThan(0));
    expect(cpu).toHaveValue(2);
    expect(patches).toHaveLength(0);
  });

  it('surfaces a failed save as a toast and shows the stored value again', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    server.use(http.patch(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.click(await screen.findByRole('switch', { name: 'Include acme/api in the environment' }));
    expect(await screen.findByText('Failed to save environment (500)')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Include acme/api in the environment' })).toBeChecked();

    const cpu = screen.getByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.type(cpu, '4{Enter}');
    await waitFor(() => expect(screen.getAllByText('Failed to save environment (500)').length).toBeGreaterThan(1));
    await waitFor(() => expect(cpu).toHaveValue(2));
  });

  it('saves the workspace setup command', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const input = await screen.findByRole('textbox', { name: 'Workspace setup command' });
    await user.type(input, 'pnpm install{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ workspaceSetupCommand: 'pnpm install' });
  });
});
