import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { DefaultModelSection } from '../DefaultModelSection';

const URL = `${TEST_BASE_URL}/web/config/default-model`;
const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
  {
    id: 'anthropic/claude-sonnet-4-5',
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-5',
    hasApiKey: true,
  },
];

async function pickModel(user: ReturnType<typeof userEvent.setup>, modelId: string) {
  await user.click(screen.getByRole('combobox', { name: 'Default model' }));
  const option = await screen.findByRole('option', { name: new RegExp(modelId) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

describe('DefaultModelSection', () => {
  it('picks and saves a personal default model', async () => {
    let modelId: string | null = null;
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId })),
      http.put(URL, () => {
        modelId = 'anthropic/claude-sonnet-4-5';
        return HttpResponse.json({ ok: true, modelId });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<DefaultModelSection models={models} modelsLoaded />);

    await screen.findByRole('combobox', { name: 'Default model' });
    await pickModel(user, 'anthropic/claude-sonnet-4-5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  });

  it('applies the saved default to running sessions and reports dormant sessions skipped', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId: 'openai/gpt-5' })),
      http.post(`${URL}/apply`, () =>
        HttpResponse.json({
          modelId: 'openai/gpt-5',
          applied: ['running-session'],
          skipped: [{ sessionId: 'dormant-session', reason: 'not-running' }],
        }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<DefaultModelSection models={models} modelsLoaded />);

    await user.click(await screen.findByRole('button', { name: 'Apply to running sessions' }));
    await waitForMutationsIdle(client);

    expect(screen.getByText('Updated 1 running session(s); skipped 1.')).toBeInTheDocument();
  });

  it('clears the personal default model', async () => {
    let modelId: string | null = 'openai/gpt-5';
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId })),
      http.delete(URL, () => {
        modelId = null;
        return HttpResponse.json({ ok: true, modelId });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<DefaultModelSection models={models} modelsLoaded />);

    await user.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled());
  });

  it('flags a saved default none of the connected accounts can run', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash' })));
    renderWithProviders(<DefaultModelSection models={models} modelsLoaded />);

    expect(
      await screen.findByText(/None of your connected accounts can run deepseek\/deepseek-flash/),
    ).toBeInTheDocument();
  });

  it('warns when the successfully loaded personal catalog is empty', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash' })));
    renderWithProviders(<DefaultModelSection models={[]} modelsLoaded />);

    expect(
      await screen.findByText(/None of your connected accounts can run deepseek\/deepseek-flash/),
    ).toBeInTheDocument();
  });

  it('does not warn before the personal catalog has loaded successfully', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'deepseek/deepseek-flash' })));
    renderWithProviders(<DefaultModelSection models={[]} modelsLoaded={false} />);

    await screen.findByRole('combobox', { name: 'Default model' });
    expect(screen.queryByText(/None of your connected accounts/)).not.toBeInTheDocument();
  });

  it('does not flag a saved default the catalog offers', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'openai/gpt-5' })));
    renderWithProviders(<DefaultModelSection models={models} modelsLoaded />);

    await screen.findByRole('combobox', { name: 'Default model' });
    expect(screen.queryByText(/None of your connected accounts/)).not.toBeInTheDocument();
  });
});
