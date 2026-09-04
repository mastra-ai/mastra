import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert/strict';
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
  editable: true,
};

/** What a drag does: the thumb moves, the value is not saved until the pointer comes up. */
const dragTo = (slider: HTMLElement, level: number) => fireEvent.change(slider, { target: { value: String(level) } });

const rowOf = (slider: HTMLElement) => {
  const row = slider.closest<HTMLElement>('[data-slot="settings-row"]');
  assert(row, 'the slider should sit inside a settings row');
  return row;
};

describe('BaseThinkingSection', () => {
  it('renders the base thinking level from the server', async () => {
    server.use(http.get(THINKING_URL, () => HttpResponse.json(baseConfig)));

    renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    expect(base).toHaveAttribute('aria-valuetext', 'Off');
  });

  it('saves the level the drag ended on', async () => {
    let requestBody: unknown;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, globalDefault: 'high', modeDefaults: baseConfig.modeDefaults });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 5);
    dragTo(base, 3);
    fireEvent.pointerUp(base);

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ globalDefault: 'high' });
    await waitFor(() => expect(base).toHaveAttribute('aria-valuetext', 'High'));
  });

  it('writes once when the slider is released and then blurred', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'high', modeDefaults: baseConfig.modeDefaults });
      }),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);
    fireEvent.blur(base);

    await waitForMutationsIdle(client);
    expect(writes).toBe(1);
  });

  it('renders read-only rows when the deployment refuses writes', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json({ ...baseConfig, editable: false })),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'high', modeDefaults: {} });
      }),
    );

    renderWithProviders(<BaseThinkingSection />);

    expect(await screen.findByText(/shared by everyone on this deployment/)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Base thinking level' })).toBeDisabled();
    expect(writes).toBe(0);
  });

  it('names the level under the thumb without saving it mid-drag', async () => {
    let writes = 0;
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () => {
        writes += 1;
        return HttpResponse.json({ ok: true, globalDefault: 'max', modeDefaults: baseConfig.modeDefaults });
      }),
    );

    renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 5);

    expect(base).toHaveAttribute('aria-valuetext', 'Max');
    expect(writes).toBe(0);
  });

  it('surfaces a write failure from the server', async () => {
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () =>
        HttpResponse.json({ error: 'Only organization admins can change thinking defaults' }, { status: 403 }),
      ),
    );

    const { client } = renderWithProviders(<BaseThinkingSection />);

    const base = await screen.findByRole('slider', { name: 'Base thinking level' });
    dragTo(base, 3);
    fireEvent.pointerUp(base);

    await waitForMutationsIdle(client);
    expect(await screen.findByText(/Only organization admins/)).toBeInTheDocument();
    await waitFor(() => expect(base).toHaveAttribute('aria-valuetext', 'Off'));
  });
});

describe('ModeThinkingDefaultsSection', () => {
  it('renders a row per mode with its override state', async () => {
    server.use(http.get(THINKING_URL, () => HttpResponse.json(baseConfig)));

    renderWithProviders(<ModeThinkingDefaultsSection />);

    // plan has an explicit override; build/fast inherit the global default.
    const plan = await screen.findByRole('slider', { name: 'plan mode thinking level' });
    expect(plan).toHaveAttribute('aria-valuetext', 'Max');
    expect(screen.getByRole('slider', { name: 'build mode thinking level' })).toHaveAttribute(
      'aria-valuetext',
      'Off · follows base',
    );
    expect(screen.getByRole('slider', { name: 'fast mode thinking level' })).toBeInTheDocument();
  });

  it('shows a failed write under the mode row that asked for it', async () => {
    server.use(
      http.get(THINKING_URL, () => HttpResponse.json(baseConfig)),
      http.put(THINKING_URL, () =>
        HttpResponse.json(
          {
            error:
              'Deployment thinking defaults are shared by the whole deployment, so they cannot be changed while authentication is enabled',
          },
          { status: 403 },
        ),
      ),
    );

    const { client } = renderWithProviders(<ModeThinkingDefaultsSection />);

    const build = await screen.findByRole('slider', { name: 'build mode thinking level' });
    dragTo(build, 3);
    fireEvent.pointerUp(build);

    await waitForMutationsIdle(client);
    const buildRow = rowOf(build);
    const planRow = rowOf(screen.getByRole('slider', { name: 'plan mode thinking level' }));

    expect(await within(buildRow).findByText(/cannot be changed while authentication is enabled/)).toBeInTheDocument();
    expect(within(planRow).queryByText(/cannot be changed while authentication is enabled/)).not.toBeInTheDocument();
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

    const plan = await screen.findByRole('slider', { name: 'plan mode thinking level' });
    await user.click(screen.getByRole('button', { name: 'Reset to base' }));

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ modeDefaults: { plan: null } });
    await waitFor(() => expect(plan).toHaveAttribute('aria-valuetext', 'Off · follows base'));
  });
});
