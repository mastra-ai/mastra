import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { EnvironmentSection } from '../EnvironmentSection';
import { customEnvironment, environmentPayload, environmentRepository, FACTORY_ID } from './fixtures/environment';

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
  it('renders the Template and Advanced parts in order, the working directory under workspace setup', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(headings).toEqual(['Template', 'Repositories', 'Workspace setup', 'Advanced', 'Sandbox']);
    const setup = screen.getByRole('heading', { name: 'Workspace setup' }).parentElement!;
    expect(within(setup).getByRole('textbox', { name: 'Working directory' })).toBeInTheDocument();
    expect(within(setup).getByRole('textbox', { name: 'Workspace setup command' })).toBeInTheDocument();
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

  it('shows every stored value: working directory, ordered repositories with status, workspace setup', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
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

    expect(await screen.findByRole('textbox', { name: 'Working directory' })).toHaveValue('/workspace');
    expect(screen.getByRole('textbox', { name: 'Workspace setup command' })).toHaveValue('pnpm install');

    // Rows follow `position`; a link whose repository is gone is not shown at all.
    const names = screen.getAllByText(/^acme\//).map(node => node.textContent);
    expect(names).toEqual(['acme/link-web', 'acme/link-api']);
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('switch', { name: /Clone .* into every session/ })).toHaveLength(2);
    expect(screen.queryByText('Configured')).not.toBeInTheDocument();
    expect(screen.getByText('Last build failed')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Clone acme/link-web into every session' })).toBeChecked();
    expect(screen.getAllByText('Cloned')).toHaveLength(2);

    // The whole row toggles its details; the switch inside it does not.
    const user = userEvent.setup();
    expect(screen.queryByText('pnpm build exited with 1')).not.toBeInTheDocument();
    await user.click(screen.getByText('acme/link-api'));
    expect(screen.getByText('pnpm build exited with 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Setup command for acme/link-api' })).toHaveValue('pnpm build');
    expect(screen.getByRole('button', { name: 'Hide details for acme/link-api' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('switch', { name: 'Clone acme/link-api into every session' }));
    expect(screen.getByRole('button', { name: 'Hide details for acme/link-api' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
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

  it('toggles a repository out of the environment', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);

    renderEnvironmentSettings();

    await userEvent.setup().click(await screen.findByRole('switch', { name: 'Clone acme/api into every session' }));

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

  it('surfaces a failed save as a toast and shows the stored value again', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    server.use(http.patch(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.click(await screen.findByRole('switch', { name: 'Clone acme/api into every session' }));
    expect(await screen.findByText('Failed to save environment (500)')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Clone acme/api into every session' })).toBeChecked();

    const workdir = screen.getByRole('textbox', { name: 'Working directory' });
    await user.clear(workdir);
    await user.type(workdir, '/home/user{Enter}');
    await waitFor(() => expect(screen.getAllByText('Failed to save environment (500)').length).toBeGreaterThan(1));
    await waitFor(() => expect(workdir).toHaveValue('/workspace'));
  });

  it('renders one row per provider setting with the stored value or the default as placeholder', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    expect(await screen.findByText(/Sandboxes run on the Mastra platform\./)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'CPU' })).toHaveValue(2);
    expect(screen.getByText('vCPUs of the sandbox.')).toBeInTheDocument();
    const memory = screen.getByRole('spinbutton', { name: 'Memory (MB)' });
    expect(memory).toHaveValue(null);
    expect(memory).toHaveAttribute('placeholder', '1024');
    expect(screen.getByRole('spinbutton', { name: 'Idle timeout (minutes)' })).toHaveAttribute('placeholder', '5');
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3);
  });

  it('saves one setting per field and clears a setting with null', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.type(await screen.findByRole('spinbutton', { name: 'Memory (MB)' }), '4096{Enter}');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ settings: { memoryMb: 4096 } });

    const cpu = screen.getByRole('spinbutton', { name: 'CPU' });
    await user.clear(cpu);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ settings: { cpuCount: null } });
  });

  it('refuses a value outside the schema range before any request', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.type(await screen.findByRole('spinbutton', { name: 'Memory (MB)' }), '256{Enter}');
    expect(await screen.findByText('Enter a whole number between 512 and 65536')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('keeps the stored value when the provider rejects a setting', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    server.use(
      http.patch(ENVIRONMENT_URL, () =>
        HttpResponse.json(
          { error: 'invalid_environment', issues: [{ message: 'must be <= 8', path: ['cpuCount'] }] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU' });
    await user.clear(cpu);
    await user.type(cpu, '16{Enter}');
    expect(await screen.findByText('Failed to save environment (400)')).toBeInTheDocument();
    await waitFor(() => expect(cpu).toHaveValue(2));
  });

  it('shows the provider line and no settings for a custom sandbox', async () => {
    useFactory();
    useEnvironment(customEnvironment());

    renderEnvironmentSettings();

    expect(await screen.findByText(/Sandboxes run on a custom sandbox\./)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Working directory' })).toBeInTheDocument();
    expect(screen.getByText('This sandbox has no settings to tune.')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders boolean and enum settings as a switch and a select, and an unsupported type as a note', async () => {
    useFactory();
    const environment = environmentPayload({
      sandbox: {
        provider: 'docker',
        settingsSchema: {
          type: 'object',
          properties: {
            privileged: { type: 'boolean', title: 'Privileged' },
            region: { type: 'string', title: 'Region', enum: ['us', 'eu'], default: 'us' },
            mounts: { type: 'array', title: 'Mounts' },
          },
        },
        capabilities: { template: true, builds: { available: false, history: false } },
      },
      settings: { region: 'eu' },
    });
    useEnvironment(environment);
    const patches = recordPatches(environment);

    renderEnvironmentSettings();

    expect(await screen.findByText(/Sandboxes run on Docker\./)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveTextContent('eu');
    expect(screen.getByText('Mounts')).toBeInTheDocument();
    expect(screen.getByText('Unsupported setting type')).toBeInTheDocument();
    const privileged = screen.getByRole('switch', { name: 'Privileged' });
    expect(privileged).not.toBeChecked();
    await userEvent.setup().click(privileged);
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ settings: { privileged: true } });
  });

  it('saves decimals for number settings, strings as typed, and clears both with null', async () => {
    useFactory();
    const environment = environmentPayload({
      sandbox: {
        provider: 'e2b',
        settingsSchema: {
          type: 'object',
          properties: {
            ratio: { type: 'number', title: 'Ratio', minimum: 0 },
            region: { type: 'string', title: 'Region', enum: ['us', 'eu'] },
            image: { type: 'string', title: 'Image' },
          },
        },
        capabilities: { template: true, builds: { available: true, history: true } },
      },
      settings: { region: 'eu', image: 'node:22' },
    });
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const ratio = await screen.findByRole('spinbutton', { name: 'Ratio' });
    await user.type(ratio, '-1{Enter}');
    expect(await screen.findByText('Enter a number of at least 0')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
    await user.clear(ratio);
    await user.type(ratio, '0.5{Enter}');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ settings: { ratio: 0.5 } });

    const image = screen.getByRole('textbox', { name: 'Image' });
    await user.clear(image);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ settings: { image: null } });

    await user.click(screen.getByRole('combobox', { name: 'Region' }));
    await user.click(await screen.findByRole('option', { name: 'Default' }));
    await waitFor(() => expect(patches).toHaveLength(3));
    expect(patches[2]).toEqual({ settings: { region: null } });
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
