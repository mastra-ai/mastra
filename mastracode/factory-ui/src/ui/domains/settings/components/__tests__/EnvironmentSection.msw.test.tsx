import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { queryKeys } from '../../../../../api/keys';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { FactoryManagementSection } from '../FactoryManagementSection';
import { customEnvironment, environmentPayload, FACTORY_ID } from './fixtures/environment';

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

function recordPatches(environment: FactoryEnvironmentPayload) {
  const patches: FactoryEnvironmentPatch[] = [];
  server.use(
    http.patch<never, FactoryEnvironmentPatch>(ENVIRONMENT_URL, async ({ request }) => {
      patches.push(await request.json());
      return HttpResponse.json({ environment });
    }),
  );
  return patches;
}

function renderEnvironmentSettings() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/factory`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/factory" element={<FactoryManagementSection />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

describe('Environment settings', () => {
  it('renders Environment with the working directory, the setup command and the provider settings, then Builds', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Environment' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(headings).toEqual(['Environment', 'Builds', 'Danger zone']);
    const workdir = screen.getByRole('textbox', { name: 'Working directory' });
    const command = screen.getByRole('textbox', { name: 'Setup command' });
    expect(workdir.closest('section')).toBe(command.closest('section'));
    expect(workdir.closest('section')).toBe(screen.getByRole('heading', { name: 'Environment' }).closest('section'));
  });

  it('saves global settings before any repository is linked', async () => {
    useFactory();
    const environment = environmentPayload({ repositories: [], workspaceSetupCommand: 'pnpm install' });
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const workdir = await screen.findByRole('textbox', { name: 'Working directory' });
    expect(workdir).toHaveValue('/workspace');
    await user.clear(workdir);
    await user.type(workdir, '/workspace/new{Enter}');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ sandboxWorkingDirectory: '/workspace/new' });
    expect(screen.getByRole('textbox', { name: 'Setup command' })).toHaveValue('pnpm install');
    expect(screen.getByRole('spinbutton', { name: 'CPU' })).toHaveValue(2);
    expect(screen.getByRole('heading', { name: 'Builds' })).toBeInTheDocument();
  });

  it('shows the load failure instead of an empty page', async () => {
    useFactory();
    server.use(http.get(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderEnvironmentSettings();

    expect(await screen.findByText('Failed to load environment (500)')).toBeInTheDocument();
  });

  it('keeps the settings on screen when refreshing the Factory list fails in the background', async () => {
    let factoryRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => {
        factoryRequests++;
        return factoryRequests === 1
          ? HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] })
          : HttpResponse.json({ error: 'Factories unavailable' }, { status: 503 });
      }),
    );
    useEnvironment(environmentPayload());

    const { client } = renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Danger zone' })).toBeInTheDocument();
    fireEvent(window, new Event('visibilitychange'));
    await waitFor(() => expect(client.getQueryState(queryKeys.factories())?.status).toBe('error'));
    expect(factoryRequests).toBe(2);
    expect(screen.queryByText(/Failed to list Factories/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Acme' })).toBeInTheDocument();
  });

  it('surfaces a failed save as a toast and shows the stored value again', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    server.use(http.patch(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const workdir = await screen.findByRole('textbox', { name: 'Working directory' });
    await user.clear(workdir);
    await user.type(workdir, '/home/user{Enter}');
    expect(await screen.findByText('Failed to save environment (500)')).toBeInTheDocument();
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

  it('drops an unsaved draft when switching to another factory', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [
            { id: FACTORY_ID, name: 'Acme' },
            { id: 'factory-b', name: 'Beta' },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-b/environment`, () => {
        const other = environmentPayload();
        return HttpResponse.json({ environment: { ...other, settings: { ...other.settings, cpuCount: 4 } } });
      }),
    );
    useEnvironment(environmentPayload());
    server.use(
      http.patch(ENVIRONMENT_URL, () =>
        HttpResponse.json(
          { error: 'invalid_environment', issues: [{ message: 'must be >= 1', path: ['cpuCount'] }] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    function SwitchFactory() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate(`/factories/${FACTORY_ID}/settings/factory`)}>Switch to Acme</button>
          <button onClick={() => navigate('/factories/factory-b/settings/factory')}>Switch to Beta</button>
        </>
      );
    }

    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-b/settings/factory']}>
        <SwitchFactory />
        <Routes>
          <Route path="/factories/:factoryId/settings/factory" element={<FactoryManagementSection />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'CPU' })).toHaveValue(4));
    await user.click(screen.getByRole('button', { name: 'Switch to Acme' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'CPU' })).toHaveValue(2));

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU' });
    await user.clear(cpu);
    await user.type(cpu, '0{Enter}');
    await waitFor(() => expect(cpu).toHaveValue(0));
    await user.click(screen.getByRole('button', { name: 'Switch to Beta' }));

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'CPU' })).toHaveValue(4));
  });

  it('shows the provider line and no settings for a custom sandbox', async () => {
    useFactory();
    useEnvironment(customEnvironment());

    renderEnvironmentSettings();

    expect(await screen.findByText(/Sandboxes run on a custom sandbox\./)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Working directory' })).toBeInTheDocument();
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

  it('suggests more memory only while Docker is on with less than 2 GB', async () => {
    const withSettings = (settings: Record<string, unknown>) => {
      const base = environmentPayload();
      return environmentPayload({
        sandbox: {
          ...base.sandbox,
          settingsSchema: {
            type: 'object',
            properties: {
              memoryMb: { type: 'integer', title: 'Memory', default: 1024 },
              docker: { type: 'boolean', title: 'Docker', default: false },
            },
          },
        },
        settings,
      });
    };
    const tip = /E2B recommends at least 2 GB for Docker/;
    useFactory();
    useEnvironment(withSettings({ docker: true }));
    const first = renderEnvironmentSettings();
    expect(await screen.findByText(tip)).toHaveTextContent('1024 MB');
    first.unmount();
    for (const settings of [{ docker: true, memoryMb: 2048 }, {}]) {
      useEnvironment(withSettings(settings));
      const view = renderEnvironmentSettings();
      expect(await screen.findByRole('switch', { name: 'Docker' })).toBeInTheDocument();
      expect(screen.queryByText(tip)).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('renders a oneOf of consts as a select labelled by title and saves the numeric value', async () => {
    useFactory();
    const environment = environmentPayload({
      sandbox: {
        provider: 'platform',
        settingsSchema: {
          type: 'object',
          properties: {
            memoryMb: {
              type: 'integer',
              title: 'Memory',
              default: 1024,
              oneOf: [
                { const: 1024, title: '1 GB' },
                { const: 8192, title: '8 GB' },
              ],
            },
          },
        },
        capabilities: { template: true, builds: { available: true, history: false } },
      },
      settings: {},
    });
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const memory = await screen.findByRole('combobox', { name: 'Memory' });
    expect(memory).toHaveTextContent('1 GB (default)');
    await user.click(memory);
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    await user.click(screen.getByRole('option', { name: '8 GB' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ settings: { memoryMb: 8192 } });

    await user.click(memory);
    await user.click(await screen.findByRole('option', { name: '1 GB (default)' }));
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ settings: { memoryMb: null } });
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

    const input = await screen.findByRole('textbox', { name: 'Setup command' });
    await user.type(input, 'pnpm install{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ workspaceSetupCommand: 'pnpm install' });
  });
});
