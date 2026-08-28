import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ThinkingConfigInfo } from '../../../../../api/types';
import { BaseThinkingSection, ModeThinkingDefaultsSection } from '../ThinkingDefaultsSection';

const THINKING_URL = `${TEST_BASE_URL}/web/config/thinking`;

const baseConfig: ThinkingConfigInfo = {
  levels: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
  globalDefault: 'off',
  modeDefaults: { plan: 'max' },
  modes: ['build', 'plan', 'fast'],
};

describe('BaseThinkingSection', () => {
  it('renders the base thinking level from the server', async () => {
    server.use(http.get(THINKING_URL, () => HttpResponse.json(baseConfig)));

    renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('group', { name: 'Base thinking level' });
    expect(within(base).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves a new base level and reflects the server response', async () => {
    let requestBody: unknown;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, globalDefault: 'high', modeDefaults: baseConfig.modeDefaults });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('group', { name: 'Base thinking level' });
    await user.click(within(base).getByRole('button', { name: 'High' }));

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ globalDefault: 'high' });
    await waitFor(() =>
      expect(within(base).getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('surfaces a write failure from the server', async () => {
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () =>
        HttpResponse.json({ error: 'Only organization admins can change thinking defaults' }, { status: 403 }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('group', { name: 'Base thinking level' });
    await user.click(within(base).getByRole('button', { name: 'High' }));

    await waitForMutationsIdle(client);
    expect(await screen.findByText(/Only organization admins/)).toBeInTheDocument();
    // The selection did not change.
    expect(within(base).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ModeThinkingDefaultsSection', () => {
  it('renders a row per mode with its override state', async () => {
    server.use(http.get(THINKING_URL, () => HttpResponse.json(baseConfig)));

    renderWithProviders(<ModeThinkingDefaultsSection />);

    // plan has an explicit override; build/fast inherit the global default.
    const plan = await screen.findByRole('group', { name: 'plan mode thinking level' });
    expect(within(plan).getByRole('button', { name: 'Max' })).toHaveAttribute('aria-pressed', 'true');
    const build = screen.getByRole('group', { name: 'build mode thinking level' });
    expect(within(build).getByRole('button', { name: 'Global' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'fast mode thinking level' })).toBeInTheDocument();
  });

  it('clears a per-mode override back to the global default with null', async () => {
    let requestBody: unknown;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, globalDefault: 'off', modeDefaults: {} });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<ModeThinkingDefaultsSection />);

    const plan = await screen.findByRole('group', { name: 'plan mode thinking level' });
    await user.click(within(plan).getByRole('button', { name: 'Global' }));

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ modeDefaults: { plan: null } });
    await waitFor(() =>
      expect(within(plan).getByRole('button', { name: 'Global' })).toHaveAttribute('aria-pressed', 'true'),
    );
  });
});
