import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { PersonalProviderFactoryStep } from '../PersonalProviderFactoryStep';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;

function registerAuthHandler() {
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
    ),
  );
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('PersonalProviderFactoryStep', () => {
  it('can continue without adding a personal credential', async () => {
    registerAuthHandler();
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ providers: [] })));
    const onContinue = vi.fn<() => void>();
    const user = userEvent.setup();

    renderWithProviders(<PersonalProviderFactoryStep onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Review setup' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('can add personal credentials for multiple providers before continuing', async () => {
    registerAuthHandler();
    const providers: ProviderInfo[] = [
      { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
      { provider: 'google', source: 'none' },
    ];
    const requests: Array<{ provider: string; body: unknown }> = [];
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.put(`${PROVIDERS_URL}/:provider/key`, async ({ params, request }) => {
        const provider = String(params.provider);
        requests.push({ provider, body: await request.json() });
        const index = providers.findIndex(candidate => candidate.provider === provider);
        const current = providers[index];
        if (current) providers[index] = { ...current, source: 'stored-user', userCredential: 'api_key' };
        return HttpResponse.json({ ok: true });
      }),
    );
    const onContinue = vi.fn<() => void>();
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PersonalProviderFactoryStep onContinue={onContinue} />);

    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-openai');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    await user.click(screen.getByRole('button', { name: 'Add another' }));
    await user.click(screen.getByRole('button', { name: 'Google' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-google');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(requests).toEqual([
      { provider: 'openai', body: { key: 'sk-openai', scope: 'user' } },
      { provider: 'google', body: { key: 'sk-google', scope: 'user' } },
    ]);
    await user.click(screen.getByRole('button', { name: 'Review setup' }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  });
});
