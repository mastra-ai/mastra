import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { ProviderInfo } from '../../../../../../shared/api/types';
import { useAvailableModelsQuery } from '../../../../../../shared/hooks/useAvailableModels';
import type { AvailableModelOption } from '../../../../../../shared/hooks/useAvailableModels';
import { providerDisplayName } from '../provider-display-name';
import { ProviderAccessSection } from '../ProviderAccessSection';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;
const oauthUrl = (provider: string, action: 'start' | 'complete' | 'poll') =>
  `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/${action}`;

function providersResponse(providers: ProviderInfo[]) {
  return HttpResponse.json({ providers });
}

function rowFor(provider: string): HTMLElement {
  const row = screen.getByText(providerDisplayName(provider)).closest('.data-list-row');
  if (!(row instanceof HTMLElement)) throw new Error(`Provider row not found for ${provider}`);
  return row;
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('ProviderAccessSection', () => {
  describe('while providers are loading', () => {
    it('renders a skeleton placeholder instead of loading text', async () => {
      server.use(
        http.get(PROVIDERS_URL, async () => {
          await delay(150);
          return providersResponse([
            { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
          ]);
        }),
      );

      renderWithProviders(<ProviderAccessSection />);

      expect(await screen.findByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading providers/)).not.toBeInTheDocument();

      expect(await screen.findByText('Anthropic')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading providers' })).not.toBeInTheDocument();
    });
  });

  describe('when providers load', () => {
    it('shows OAuth providers on the default tab and API-key providers behind the second tab with search', async () => {
      server.use(
        http.get(PROVIDERS_URL, () =>
          providersResponse([
            { provider: 'openai', source: 'stored' },
            { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
            { provider: 'google', source: 'none' },
          ]),
        ),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      expect(screen.getByRole('tab', { name: 'Sign in with a provider' })).toBeInTheDocument();
      const oauthPanel = screen.getByRole('tabpanel', { name: 'Sign in with a provider' });
      expect(await within(oauthPanel).findByText('Anthropic')).toBeInTheDocument();
      expect(within(rowFor('anthropic')).getByRole('button', { name: 'Sign in to Anthropic' })).toBeInTheDocument();
      // API-key providers live on the other tab.
      expect(within(oauthPanel).queryByText('OpenAI')).not.toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
      const apiKeyPanel = screen.getByRole('tabpanel', { name: 'Connect with API key' });
      expect(await within(apiKeyPanel).findByText('OpenAI')).toBeInTheDocument();
      expect(within(apiKeyPanel).getByText('Google')).toBeInTheDocument();
      // OAuth-capable providers also accept API keys, so they stay listed here.
      expect(within(apiKeyPanel).getByText('Anthropic')).toBeInTheDocument();
      expect(within(apiKeyPanel).getByRole('button', { name: 'Add API key for Anthropic' })).toBeInTheDocument();

      await user.type(screen.getByLabelText('Search providers'), 'openai');
      expect(within(apiKeyPanel).getByText('OpenAI')).toBeInTheDocument();
      expect(within(apiKeyPanel).queryByText('Google')).not.toBeInTheDocument();
      expect(within(apiKeyPanel).queryByText('Anthropic')).not.toBeInTheDocument();
    });
  });

  describe('when the list fails to load', () => {
    it('surfaces an error', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

      renderWithProviders(<ProviderAccessSection />);

      expect(await screen.findByText('nope')).toBeInTheDocument();
    });
  });

  describe('when a key is saved through the dialog', () => {
    it('PUTs the key with the provider envVar and refetches so the provider shows as configured', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none', envVar: 'OPENAI_API_KEY' }];
      let putBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          providers[0] = { provider: 'openai', source: 'stored', envVar: 'OPENAI_API_KEY' };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
      await screen.findByText('OpenAI');

      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Add API key for OpenAI' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-test', envVar: 'OPENAI_API_KEY' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument());
    });
  });

  describe('when a stored key is removed', () => {
    it('DELETEs the key and refetches so the provider drops out of the list', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'stored' }];
      let removed = false;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.delete(keyUrl('openai'), () => {
          removed = true;
          providers.length = 0;
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
      await screen.findByText('OpenAI');
      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Remove key for OpenAI' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('OpenAI')).not.toBeInTheDocument());
    });
  });

  describe('when an OAuth provider uses a paste-code flow', () => {
    it('starts the flow, completes it, and refetches the signed-in status', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
      ];
      let completeBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.post(oauthUrl('anthropic', 'start'), async ({ request }) => {
          expect(await request.json()).toEqual({ mode: 'paste-code' });
          return HttpResponse.json({
            sessionId: 'session-1',
            kind: 'paste-code',
            url: 'https://example.com/authorize',
            instructions: 'Authorize and paste the code.',
            expiresAt: Date.now() + 60_000,
          });
        }),
        http.post(oauthUrl('anthropic', 'complete'), async ({ request }) => {
          completeBody = await request.json();
          providers[0] = { provider: 'anthropic', source: 'oauth-user', oauth: providers[0].oauth };
          return HttpResponse.json({ status: 'complete', ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await screen.findByText('Anthropic');
      await user.click(within(rowFor('anthropic')).getByRole('button', { name: 'Sign in to Anthropic' }));
      await user.type(await screen.findByLabelText('Authorization code'), 'code#state');
      await user.click(screen.getByRole('button', { name: 'Complete sign in' }));

      await waitFor(() => expect(completeBody).toEqual({ sessionId: 'session-1', code: 'code#state' }));
      await waitFor(() => expect(within(rowFor('anthropic')).getByText('Signed in')).toBeInTheDocument());
    });
  });

  describe('when a signed-in provider signs out', () => {
    it('DELETEs the OAuth credential and refetches the status', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'anthropic', source: 'oauth-user', oauth: { supported: true, modes: ['paste-code'] } },
      ];
      let signedOut = false;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.delete(`${PROVIDERS_URL}/anthropic/oauth`, () => {
          signedOut = true;
          providers[0] = { provider: 'anthropic', source: 'none', oauth: providers[0].oauth };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await screen.findByText('Anthropic');
      expect(within(rowFor('anthropic')).getByText('Signed in')).toBeInTheDocument();
      await user.click(within(rowFor('anthropic')).getByRole('button', { name: 'Sign out of Anthropic' }));

      await waitFor(() => expect(signedOut).toBe(true));
      await waitFor(() => expect(within(rowFor('anthropic')).getByText('Not set')).toBeInTheDocument());
    });
  });

  describe('when an OAuth provider uses a device-code flow', () => {
    it('shows the user code and polls until sign-in completes', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'xai', source: 'none', oauth: { supported: true, modes: ['device-code'] } },
      ];
      let pollCount = 0;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.post(oauthUrl('xai', 'start'), () =>
          HttpResponse.json({
            sessionId: 'session-2',
            kind: 'device-code',
            url: 'https://example.com/device',
            userCode: 'GROK-123',
            instructions: 'Enter this code.',
            expiresAt: Date.now() + 60_000,
            nextPollMs: 100,
          }),
        ),
        http.post(oauthUrl('xai', 'poll'), () => {
          pollCount += 1;
          if (pollCount === 1) return HttpResponse.json({ status: 'pending', nextPollMs: 100 });
          providers[0] = { provider: 'xai', source: 'oauth-user', oauth: providers[0].oauth };
          return HttpResponse.json({ status: 'complete', ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await screen.findByText('xAI');
      await user.click(within(rowFor('xai')).getByRole('button', { name: 'Sign in to xAI' }));

      expect(await screen.findByText('GROK-123')).toBeInTheDocument();
      await waitFor(() => expect(within(rowFor('xai')).getByText('Signed in')).toBeInTheDocument());
    });

    it('closes after persistence without issuing a stale second poll', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'openai', source: 'none', oauth: { supported: true, modes: ['device-code'] } },
      ];
      let pollCount = 0;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.post(oauthUrl('openai', 'start'), () =>
          HttpResponse.json({
            sessionId: 'session-race',
            kind: 'device-code',
            url: 'https://example.com/device',
            userCode: 'OPENAI-123',
            instructions: 'Enter this code.',
            expiresAt: Date.now() + 60_000,
            nextPollMs: 10,
          }),
        ),
        http.post(oauthUrl('openai', 'poll'), async () => {
          pollCount += 1;
          if (pollCount > 1) {
            await delay(50);
            return HttpResponse.error();
          }
          await delay(20);
          providers[0] = { provider: 'openai', source: 'oauth-user', oauth: providers[0].oauth };
          return HttpResponse.json({ status: 'complete', ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await screen.findByText('OpenAI');
      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Sign in to OpenAI' }));

      expect(await screen.findByText('OPENAI-123')).toBeInTheDocument();
      await waitFor(() => expect(within(rowFor('openai')).getByText('Signed in')).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(pollCount).toBe(1);
    });
  });

  describe('when auth is enabled', () => {
    it('saves an organization-scoped API key and shows the org badge', async () => {
      window.__MASTRACODE_CONFIG__ = { authEnabled: true };
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none' }];
      let putBody: unknown;
      server.use(
        http.get(`${TEST_BASE_URL}/auth/me`, () =>
          HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
        ),
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          providers[0] = { provider: 'openai', source: 'stored-org' };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProviderAccessSection />);

      await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
      await screen.findByText('OpenAI');
      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Add API key for OpenAI' }));
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-org');
      await user.click(screen.getByText('Everyone in org'));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-org', scope: 'org' }));
      await waitFor(() => expect(within(rowFor('openai')).getByText('Org key')).toBeInTheDocument());
    });
  });

  describe('when a credential changes', () => {
    it('refetches the model catalog so newly runnable models appear', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none', envVar: 'OPENAI_API_KEY' }];
      const models: AvailableModelOption[] = [];
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models })),
        http.put(keyUrl('openai'), () => {
          providers[0] = { provider: 'openai', source: 'stored', envVar: 'OPENAI_API_KEY' };
          models.push({ id: 'openai/gpt-4o', provider: 'openai', modelName: 'gpt-4o', hasApiKey: true });
          return HttpResponse.json({ ok: true });
        }),
      );

      function ModelCatalogProbe() {
        const query = useAvailableModelsQuery();
        return <div data-testid="model-catalog">{(query.data ?? []).map(m => m.id).join(',')}</div>;
      }

      const user = userEvent.setup();
      renderWithProviders(
        <>
          <ProviderAccessSection />
          <ModelCatalogProbe />
        </>,
      );

      await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
      await screen.findByText('OpenAI');
      await waitFor(() => expect(screen.getByTestId('model-catalog').textContent).toBe(''));

      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Add API key for OpenAI' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Saving a key must invalidate the model catalog, not just the provider list.
      await waitFor(() => expect(screen.getByTestId('model-catalog').textContent).toBe('openai/gpt-4o'));
    });
  });
});
