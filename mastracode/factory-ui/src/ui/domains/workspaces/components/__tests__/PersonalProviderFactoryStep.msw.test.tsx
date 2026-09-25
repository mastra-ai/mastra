import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { providerDisplayName } from '../../../settings/components/provider-display-name';
import { PersonalProviderFactoryStep } from '../PersonalProviderFactoryStep';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;

function rowFor(provider: string): HTMLElement {
  const row = screen.getByText(providerDisplayName(provider)).closest('[data-slot="settings-row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`Provider row not found for ${provider}`);
  return row;
}

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

    await user.click(screen.getByRole('button', { name: 'Continue' }));

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

    await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
    await screen.findByText('OpenAI');
    expect(within(rowFor('openai')).getByText('Not set')).toBeInTheDocument();

    await user.click(within(rowFor('openai')).getByRole('button', { name: 'Add API key for OpenAI' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-openai');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    await user.click(within(rowFor('google')).getByRole('button', { name: 'Add API key for Google' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-google');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(requests).toEqual([
      { provider: 'openai', body: { key: 'sk-openai', scope: 'user' } },
      { provider: 'google', body: { key: 'sk-google', scope: 'user' } },
    ]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  });
});
