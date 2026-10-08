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

/** Records every PATCH body and answers with the given environment, optionally flagging a queued build. */
function recordPatches(environment: FactoryEnvironmentPayload, extra: { buildRequested?: boolean } = {}) {
  const patches: FactoryEnvironmentPatch[] = [];
  server.use(
    http.patch(ENVIRONMENT_URL, async ({ request }) => {
      patches.push((await request.json()) as FactoryEnvironmentPatch);
      return HttpResponse.json({ environment, ...extra });
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

    expect(await screen.findByText('platform')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'CPU cores' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Memory in megabytes' })).toHaveValue(4096);
    expect(screen.getByRole('spinbutton', { name: 'Idle timeout in minutes' })).toHaveValue(null);
    expect(screen.getByRole('textbox', { name: 'Working directory' })).toHaveValue('/workspace');
    expect(screen.getByRole('textbox', { name: 'Workspace setup command' })).toHaveValue('pnpm install');

    const names = screen.getAllByText(/^acme\/|Repository unavailable/).map(node => node.textContent);
    expect(names).toEqual(['acme/link-web', 'acme/link-api', 'Repository unavailable']);
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('Last build failed')).toBeInTheDocument();
    expect(screen.getByText('Unbuilt')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Include acme/link-web in the environment' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Include Repository unavailable in the environment' })).toBeDisabled();

    expect(screen.queryByText('pnpm build exited with 1')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show details for acme/link-api' }));
    expect(screen.getByText('pnpm build exited with 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Setup command for acme/link-api' })).toHaveValue('pnpm build');
  });

  it('reorders repositories with renumbered positions and carries dead links along unchanged', async () => {
    useFactory();
    const environment = environmentPayload({
      repositories: [
        environmentRepository({ projectRepositoryId: 'link-web', position: 1 }),
        environmentRepository({ projectRepositoryId: 'link-api', position: 2, setupCommand: 'pnpm build' }),
        environmentRepository({ projectRepositoryId: 'link-gone', slug: null, position: 3 }),
      ],
    });
    useEnvironment(environment);
    const patches = recordPatches(environment);

    renderEnvironmentSettings();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Move acme/link-api up' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      repositories: [
        {
          projectRepositoryId: 'link-api',
          position: 1,
          inEnvironment: true,
          setupCommand: 'pnpm build',
          teardownCommand: null,
        },
        {
          projectRepositoryId: 'link-web',
          position: 2,
          inEnvironment: true,
          setupCommand: null,
          teardownCommand: null,
        },
        // The route counts every link of the project, dead ones included.
        {
          projectRepositoryId: 'link-gone',
          position: 3,
          inEnvironment: true,
          setupCommand: null,
          teardownCommand: null,
        },
      ],
    });
    expect(screen.getByRole('button', { name: 'Move acme/link-web up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Repository unavailable up' })).toBeDisabled();
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

  it('patches one resource field at a time and announces a queued build', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment, { buildRequested: true });
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.type(cpu, '4{Enter}');

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ sandboxCpuCount: 4 });
    expect(await screen.findByText('Changes to the environment start a new build.')).toBeInTheDocument();

    const idle = screen.getByRole('spinbutton', { name: 'Idle timeout in minutes' });
    await user.clear(idle);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ sandboxIdleTimeoutMinutes: null });
  });

  it('drops the build notice once a later save does not queue one', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    let queue = true;
    const patches: FactoryEnvironmentPatch[] = [];
    server.use(
      http.patch(ENVIRONMENT_URL, async ({ request }) => {
        patches.push((await request.json()) as FactoryEnvironmentPatch);
        return HttpResponse.json(queue ? { environment, buildRequested: true } : { environment });
      }),
    );
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cpu = await screen.findByRole('spinbutton', { name: 'CPU cores' });
    await user.clear(cpu);
    await user.type(cpu, '4{Enter}');
    expect(await screen.findByText('Changes to the environment start a new build.')).toBeInTheDocument();

    queue = false;
    await user.click(screen.getByRole('switch', { name: 'Rebuild on a schedule' }));
    await waitFor(() => expect(patches).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByText('Changes to the environment start a new build.')).not.toBeInTheDocument(),
    );
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

  it('round-trips the build triggers one field at a time', async () => {
    useFactory();
    const environment = environmentPayload();
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    await user.click(await screen.findByRole('switch', { name: 'Rebuild on a schedule' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ buildTriggers: { schedule: { enabled: false } } });

    const hours = screen.getByRole('spinbutton', { name: 'Schedule interval in hours' });
    await user.clear(hours);
    await user.type(hours, '12{Enter}');
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ buildTriggers: { schedule: { hours: 12 } } });

    const debounce = screen.getByRole('spinbutton', { name: 'Push debounce in minutes' });
    await user.clear(debounce);
    await user.type(debounce, '0{Enter}');
    await waitFor(() => expect(patches).toHaveLength(3));
    expect(patches[2]).toEqual({ buildTriggers: { onPush: { debounceMinutes: 0 } } });

    const cap = screen.getByRole('spinbutton', { name: 'Max push builds per hour' });
    expect(cap).toHaveValue(4);
    await user.clear(cap);
    await user.tab();
    await waitFor(() => expect(patches).toHaveLength(4));
    expect(patches[3]).toEqual({ buildTriggers: { onPush: { maxPerHour: null } } });
  });

  it('renders an unlimited cap as an empty field and sends a number back', async () => {
    useFactory();
    const environment = environmentPayload({
      buildTriggers: {
        schedule: { enabled: true, hours: 24 },
        onPush: { enabled: true, debounceMinutes: 10, maxPerHour: null },
      },
    });
    useEnvironment(environment);
    const patches = recordPatches(environment);
    const user = userEvent.setup();

    renderEnvironmentSettings();

    const cap = await screen.findByRole('spinbutton', { name: 'Max push builds per hour' });
    expect(cap).toHaveValue(null);
    expect(cap).toHaveAttribute('placeholder', 'unlimited');
    await user.type(cap, '6{Enter}');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ buildTriggers: { onPush: { maxPerHour: 6 } } });
  });

  it('warns that push triggers cannot fire when the host delivers no pushes', async () => {
    useFactory();
    useEnvironment(environmentPayload({ build: { ...environmentPayload().build, pushSignal: 'none' } }));

    renderEnvironmentSettings();

    expect(await screen.findByText(/Pushes are not delivered to this Factory/)).toBeInTheDocument();
  });

  it('keeps the push warning quiet while the push trigger is off', async () => {
    useFactory();
    const base = environmentPayload();
    useEnvironment(
      environmentPayload({
        build: { ...base.build, pushSignal: 'none' },
        buildTriggers: { ...base.buildTriggers, onPush: { ...base.buildTriggers.onPush, enabled: false } },
      }),
    );

    renderEnvironmentSettings();

    await screen.findByRole('switch', { name: 'Rebuild on push' });
    expect(screen.queryByText(/Pushes are not delivered to this Factory/)).not.toBeInTheDocument();
  });

  it('shows no push warning while the polling worker delivers pushes', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    await screen.findByRole('switch', { name: 'Rebuild on push' });
    expect(screen.queryByText(/Pushes are not delivered to this Factory/)).not.toBeInTheDocument();
  });

  it('shows the last build: status, template id and error', async () => {
    useFactory();
    useEnvironment(
      environmentPayload({
        build: {
          status: 'failed',
          error: 'pnpm install exited with 1',
          lastBuiltAt: '2026-10-07T12:00:00.000Z',
          activeTemplateId: 'tpl-0123456789abcdef',
          requestedAt: null,
          pushSignal: 'polling',
        },
      }),
    );

    renderEnvironmentSettings();

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByTitle('tpl-0123456789abcdef')).toHaveTextContent('tpl-0123456789abcdef');
    expect(screen.getByText('pnpm install exited with 1')).toBeInTheDocument();
    expect(screen.queryByText('Build requested')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build now' })).toBeEnabled();
  });

  it('disables Build now while a build is running', async () => {
    useFactory();
    useEnvironment(environmentPayload({ build: { ...environmentPayload().build, status: 'building' } }));

    renderEnvironmentSettings();

    expect(await screen.findByRole('button', { name: 'Building…' })).toBeDisabled();
    expect(screen.getByText('Building')).toBeInTheDocument();
  });

  it('Build now posts to the build route and the status shows the request after refetch', async () => {
    useFactory();
    const before = environmentPayload();
    const requested: FactoryEnvironmentPayload = {
      ...before,
      build: { ...before.build, requestedAt: '2026-10-07T12:00:00.000Z' },
    };
    let builds = 0;
    server.use(
      http.get(ENVIRONMENT_URL, () => HttpResponse.json({ environment: builds === 0 ? before : requested })),
      http.post(`${ENVIRONMENT_URL}/build`, () => {
        builds += 1;
        return HttpResponse.json({ requested: true, build: requested.build });
      }),
    );

    renderEnvironmentSettings();

    expect(await screen.findByText('Never built')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Build now' }));

    await waitFor(() => expect(builds).toBe(1));
    expect(await screen.findByText('Build requested')).toBeInTheDocument();
  });
});
