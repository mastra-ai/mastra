import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type {
  FactoryEnvironmentBuild,
  FactoryEnvironmentPatch,
  FactoryEnvironmentPayload,
} from '../../../workspaces/services/environment';
import { EnvironmentSection } from '../EnvironmentSection';
import {
  buildHistory,
  buildTriggers,
  customEnvironment,
  e2bEnvironment,
  environmentPayload,
  FACTORY_ID,
} from './fixtures/environment';

const ENVIRONMENT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`;

function useFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] }),
    ),
  );
}

/** Serves the environment from a mutable holder so a handler can change what the next GET returns. */
function useEnvironment(holder: { environment: FactoryEnvironmentPayload }) {
  const reads = { count: 0 };
  server.use(
    http.get(ENVIRONMENT_URL, () => {
      reads.count += 1;
      return HttpResponse.json({ environment: holder.environment });
    }),
  );
  return reads;
}

function recordPatches(holder: { environment: FactoryEnvironmentPayload }, buildRequested = false) {
  const patches: FactoryEnvironmentPatch[] = [];
  server.use(
    http.patch(ENVIRONMENT_URL, async ({ request }) => {
      const patch = (await request.json()) as FactoryEnvironmentPatch;
      patches.push(patch);
      const schedule = patch.buildTriggers?.schedule;
      if (schedule?.cron && holder.environment.buildTriggers) {
        holder.environment = {
          ...holder.environment,
          buildTriggers: {
            ...holder.environment.buildTriggers,
            schedule: { ...holder.environment.buildTriggers.schedule, cron: schedule.cron },
          },
        };
      }
      return HttpResponse.json({ environment: { ...holder.environment, buildRequested } });
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

describe('Environment builds', () => {
  it('shows no build blocks for a sandbox without the builds capability', async () => {
    useFactory();
    useEnvironment({ environment: customEnvironment() });

    renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build now/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Builds' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Rebuild on push' })).toBeNull();
  });

  it('builds now from the Builds header, polls until ready, and lists no history on platform', async () => {
    const holder = { environment: environmentPayload() };
    useFactory();
    const reads = useEnvironment(holder);
    let posts = 0;
    let historyReads = 0;
    const statuses: FactoryEnvironmentBuild['status'][] = ['building', 'ready'];
    server.use(
      http.post(`${ENVIRONMENT_URL}/build`, () => {
        posts += 1;
        holder.environment = {
          ...holder.environment,
          build: { buildId: 'bld-1', attemptedAt: '2026-10-08T10:00:00Z' },
        };
        return HttpResponse.json({ outcome: 'started', buildId: 'bld-1', templateId: 'tpl-1' });
      }),
      http.get(`${ENVIRONMENT_URL}/builds`, () => {
        historyReads += 1;
        return HttpResponse.json({ error: 'no_history' }, { status: 404 });
      }),
      http.get(`${ENVIRONMENT_URL}/builds/:buildId`, ({ params }) => {
        const status = statuses.length > 1 ? statuses.shift()! : statuses[0]!;
        return HttpResponse.json({ build: { buildId: params.buildId, status, templateId: 'tpl-1' } });
      }),
    );

    renderEnvironmentSettings();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Build now' }));

    expect(await screen.findByText('Build started')).toBeInTheDocument();
    expect(posts).toBe(1);
    expect(await screen.findByText('Building')).toBeInTheDocument();
    // The second status read answers ready; the poll interval is 10 s, so force the refetch React Query
    // does when the tab becomes visible again.
    window.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByText('Ready', {}, { timeout: 5_000 })).toBeInTheDocument();
    // The workflow pins the template on its own poll after the provider reports
    // ready, so the environment keeps refetching every 5 s until the pin shows.
    const readsAtReady = reads.count;
    holder.environment = { ...holder.environment, activeTemplateId: 'tpl-1' };
    await waitFor(() => expect(reads.count).toBeGreaterThan(readsAtReady), { timeout: 8_000 });
    const readsAtPin = reads.count;
    await new Promise(resolve => setTimeout(resolve, 6_000));
    expect(reads.count).toBe(readsAtPin);
    expect(historyReads).toBe(0);
    expect(screen.getByRole('heading', { name: 'Builds' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Build tpl/ })).toBeNull();
  }, 25_000);

  it('patches the push trigger and its debounce, and the cron schedule', async () => {
    const holder = {
      environment: environmentPayload({
        buildTriggers: buildTriggers({ push: { enabled: true, debounceMinutes: 10 } }),
      }),
    };
    useFactory();
    useEnvironment(holder);
    const patches = recordPatches(holder);

    renderEnvironmentSettings();
    const user = userEvent.setup();

    const pushSwitch = await screen.findByRole('switch', { name: 'Rebuild on push' });
    expect(pushSwitch).toBeChecked();
    await user.click(pushSwitch);
    await waitFor(() => expect(patches).toEqual([{ buildTriggers: { push: { enabled: false } } }]));

    const debounce = screen.getByRole('spinbutton', { name: 'Push debounce in minutes' });
    await user.clear(debounce);
    await user.type(debounce, '30{Enter}');
    await waitFor(() => expect(patches.at(-1)).toEqual({ buildTriggers: { push: { debounceMinutes: 30 } } }));

    await user.clear(debounce);
    await user.type(debounce, '5000{Enter}');
    expect(await screen.findByText('Enter a whole number between 0 and 1440')).toBeInTheDocument();
    expect(patches).toHaveLength(2);

    await user.click(screen.getByRole('switch', { name: 'Rebuild on a schedule' }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ buildTriggers: { schedule: { enabled: true, cron: '0 3 * * *' } } }),
    );
  });

  it('shows the schedule notice and disables the switch when the host has no schedules', async () => {
    const holder = {
      environment: environmentPayload({
        buildTriggers: buildTriggers({
          schedule: { enabled: false, cron: null, timezone: null, scheduleAvailable: false },
        }),
      }),
    };
    useFactory();
    useEnvironment(holder);

    renderEnvironmentSettings();

    expect(await screen.findByText(/Needs a storage adapter with schedules/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Rebuild on a schedule' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Rebuild on push' })).toBeEnabled();
  });

  it('edits an enabled schedule through the preset rows, and as a cron when custom', async () => {
    const holder = {
      environment: environmentPayload({
        buildTriggers: buildTriggers({
          schedule: { enabled: true, cron: '0 3 * * *', timezone: 'UTC', scheduleAvailable: true },
        }),
      }),
    };
    useFactory();
    useEnvironment(holder);
    const patches = recordPatches(holder);

    renderEnvironmentSettings();
    const user = userEvent.setup();

    const frequency = await screen.findByRole('combobox', { name: 'Build frequency' });
    expect(frequency).toHaveTextContent('Daily');
    expect(screen.getByRole('combobox', { name: 'Build time' })).toHaveTextContent('03:00');
    expect(screen.queryByRole('combobox', { name: 'Build day' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Build schedule cron' })).toBeNull();

    await user.click(frequency);
    await user.click(await screen.findByRole('option', { name: 'Weekly' }));
    await waitFor(() =>
      expect(patches).toEqual([{ buildTriggers: { schedule: { enabled: true, cron: '0 3 * * 1' } } }]),
    );
    expect(await screen.findByRole('combobox', { name: 'Build day' })).toHaveTextContent('Monday');

    await user.click(screen.getByRole('combobox', { name: 'Build day' }));
    await user.click(await screen.findByRole('option', { name: 'Friday' }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ buildTriggers: { schedule: { enabled: true, cron: '0 3 * * 5' } } }),
    );

    await user.click(screen.getByRole('combobox', { name: 'Build time' }));
    await user.click(await screen.findByRole('option', { name: '22:00' }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ buildTriggers: { schedule: { enabled: true, cron: '0 22 * * 5' } } }),
    );

    await user.click(screen.getByRole('combobox', { name: 'Build frequency' }));
    await user.click(await screen.findByRole('option', { name: 'Custom' }));
    const cron = await screen.findByRole('textbox', { name: 'Build schedule cron' });
    expect(cron).toHaveValue('0 22 * * 5');
    await user.clear(cron);
    await user.type(cron, '0 */6 * * *{Enter}');
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ buildTriggers: { schedule: { enabled: true, cron: '0 */6 * * *' } } }),
    );
    expect(patches).toHaveLength(4);
  });

  it('lists the provider history and opens a failed build to its logs', async () => {
    const holder = { environment: e2bEnvironment() };
    useFactory();
    useEnvironment(holder);
    server.use(http.get(`${ENVIRONMENT_URL}/builds`, () => HttpResponse.json({ builds: buildHistory() })));

    renderEnvironmentSettings();
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Builds' })).toBeInTheDocument();
    const failed = await screen.findByRole('button', { name: 'Build tpl-1:bld-2' });
    const ready = screen.getByRole('button', { name: 'Build tpl-1:bld-1' });
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(within(ready).getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByText(/ERR_PNPM_FETCH/)).toBeNull();

    await user.click(failed);
    expect(screen.getByText('pnpm install exited with 1')).toBeInTheDocument();
    expect(screen.getByText(/ERR_PNPM_FETCH 404/)).toBeInTheDocument();
    expect(failed).toHaveAttribute('aria-expanded', 'true');
  });

  it('toasts Build queued when a settings save started a build', async () => {
    const holder = { environment: environmentPayload() };
    useFactory();
    useEnvironment(holder);
    const patches = recordPatches(holder, true);

    renderEnvironmentSettings();
    const user = userEvent.setup();

    const memory = await screen.findByRole('spinbutton', { name: 'Memory (MB)' });
    await user.type(memory, '4096{Enter}');
    expect(await screen.findByText('Build queued')).toBeInTheDocument();
    expect(patches).toEqual([{ settings: { memoryMb: 4096 } }]);
  });
});
