import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import type { TitleGenerationConfigInfo } from '../../../../../api/types';
import { TitleGenerationSection } from '../TitleGenerationSection';

const TITLE_URL = `${TEST_BASE_URL}/web/config/title-generation`;
const MODELS: AvailableModelOption[] = [
  { id: 'openai/gpt-5.4-mini', provider: 'openai', modelName: 'gpt-5.4-mini', hasApiKey: true },
  { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
];

const enabledConfig: TitleGenerationConfigInfo = { enabled: true, modelId: null, thinkingLevel: null };

describe('TitleGenerationSection', () => {
  it('renders the toggle and model rows when generation is on', async () => {
    server.use(http.get(TITLE_URL, () => HttpResponse.json(enabledConfig)));

    renderWithProviders(<TitleGenerationSection models={MODELS} />);

    // The model row only renders once the config has loaded and enabled is set.
    expect(await screen.findByRole('combobox', { name: 'Thread title model' })).toBeInTheDocument();
    const toggle = screen.getByRole('group', { name: 'Automatic thread titles' });
    expect(within(toggle).getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Thread title thinking level' })).toBeInTheDocument();
  });

  it('hides the model rows when generation is off', async () => {
    server.use(
      http.get(TITLE_URL, () => HttpResponse.json({ ...enabledConfig, enabled: false })),
    );

    renderWithProviders(<TitleGenerationSection models={MODELS} />);

    const toggle = await screen.findByRole('group', { name: 'Automatic thread titles' });
    expect(within(toggle).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox', { name: 'Thread title model' })).not.toBeInTheDocument();
  });

  it('saves the toggle and reflects the server response', async () => {
    let requestBody: unknown;
    server.use(
      http.get(TITLE_URL, () => HttpResponse.json(enabledConfig)),
      http.put(TITLE_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ok: true, config: { ...enabledConfig, enabled: false } });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<TitleGenerationSection models={MODELS} />);

    const toggle = await screen.findByRole('group', { name: 'Automatic thread titles' });
    await user.click(within(toggle).getByRole('button', { name: 'Off' }));

    await waitForMutationsIdle(client);
    expect(requestBody).toEqual({ enabled: false });
    await waitFor(() => {
      expect(within(toggle).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('combobox', { name: 'Thread title model' })).not.toBeInTheDocument();
    });
  });

  it('pins a writer model and resets it back to the default', async () => {
    let lastBody: unknown;
    server.use(
      http.get(TITLE_URL, () => HttpResponse.json(enabledConfig)),
      http.put(TITLE_URL, async ({ request }) => {
        lastBody = await request.json();
        const body = lastBody as { modelId?: string | null };
        return HttpResponse.json({ ok: true, config: { ...enabledConfig, modelId: body.modelId ?? null } });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<TitleGenerationSection models={MODELS} />);

    const combobox = await screen.findByRole('combobox', { name: 'Thread title model' });
    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: /openai\/gpt-5\.4-mini/ }));

    await waitForMutationsIdle(client);
    expect(lastBody).toEqual({ modelId: 'openai/gpt-5.4-mini' });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Thread title model' })).toHaveTextContent('openai/gpt-5.4-mini'));

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    await waitForMutationsIdle(client);
    expect(lastBody).toEqual({ modelId: null });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Thread title model' })).not.toHaveTextContent('openai/gpt-5.4-mini'),
    );
  });

  it('pins a thinking level and resets it back to the default', async () => {
    let lastBody: unknown;
    server.use(
      http.get(TITLE_URL, () => HttpResponse.json(enabledConfig)),
      http.put(TITLE_URL, async ({ request }) => {
        lastBody = await request.json();
        const body = lastBody as { thinkingLevel?: string | null };
        return HttpResponse.json({ ok: true, config: { ...enabledConfig, thinkingLevel: body.thinkingLevel ?? null } });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<TitleGenerationSection models={MODELS} />);

    await user.click(await screen.findByRole('combobox', { name: 'Thread title thinking level' }));
    await user.click(await screen.findByRole('option', { name: 'Low' }));

    await waitForMutationsIdle(client);
    expect(lastBody).toEqual({ thinkingLevel: 'low' });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Thread title thinking level' })).toHaveTextContent('Low'),
    );

    await user.click(screen.getByRole('combobox', { name: 'Thread title thinking level' }));
    await user.click(await screen.findByRole('option', { name: 'Default' }));

    await waitForMutationsIdle(client);
    expect(lastBody).toEqual({ thinkingLevel: null });
  });

  it('surfaces a write failure and keeps the previous state', async () => {
    server.use(
      http.get(TITLE_URL, () => HttpResponse.json(enabledConfig)),
      http.put(TITLE_URL, () => HttpResponse.json({ error: 'title_settings_unavailable' }, { status: 503 })),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<TitleGenerationSection models={MODELS} />);

    const toggle = await screen.findByRole('group', { name: 'Automatic thread titles' });
    await user.click(within(toggle).getByRole('button', { name: 'Off' }));

    await waitForMutationsIdle(client);
    expect(await screen.findByText(/title_settings_unavailable/)).toBeInTheDocument();
    expect(within(toggle).getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays usable with the server defaults when the config cannot be loaded', async () => {
    server.use(http.get(TITLE_URL, () => HttpResponse.text('<!doctype html>', { status: 200 })));

    const user = userEvent.setup();
    const { client } = renderWithProviders(<TitleGenerationSection models={MODELS} />);

    // The failed GET falls back to the server default (on) instead of dead buttons.
    const toggle = await screen.findByRole('group', { name: 'Automatic thread titles' });
    const onButton = within(toggle).getByRole('button', { name: 'On' });
    await waitFor(() => expect(onButton).toBeEnabled());

    server.use(http.put(TITLE_URL, () => HttpResponse.json({ ok: true, config: { ...enabledConfig, enabled: false } })));
    await user.click(within(toggle).getByRole('button', { name: 'Off' }));

    await waitForMutationsIdle(client);
    expect(within(toggle).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  });
});
