import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { ProviderInfo } from '../../../../../../shared/api/types';
import { providerDisplayName } from '../provider-display-name';
import { ProvidersSection } from '../ProvidersSection';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;
const oauthUrl = (provider: string, action: 'start' | 'complete' | 'poll') =>
  `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/${action}`;

function providersResponse(providers: ProviderInfo[]) {
  return HttpResponse.json({ providers });
}

function rowFor(provider: string): HTMLLIElement {
  const row = screen.getByText(providerDisplayName(provider)).closest('li');
  if (!(row instanceof HTMLLIElement)) throw new Error(`Provider row not found for ${provider}`);
  return row;
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('ProvidersSection', () => {
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

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading providers/)).not.toBeInTheDocument();

      expect(await screen.findByText('Anthropic')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading providers' })).not.toBeInTheDocument();
    });
  });

  describe('when providers load', () => {
    it('shows OAuth providers above a browsable API-key list and filters that list through search', async () => {
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
      renderWithProviders(<ProvidersSection />);

      expect(screen.getByRole('heading', { name: 'Sign in with a provider' })).toBeInTheDocument();
      const anthropic = await screen.findByText('Anthropic');
      const search = screen.getByLabelText('Search providers');
      expect(anthropic.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(await screen.findByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Google')).toBeInTheDocument();

      await user.type(search, 'openai');
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.queryByText('Google')).not.toBeInTheDocument();
    });
  });

  describe('when the list fails to load', () => {
    it('surfaces an error', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByText('nope')).toBeInTheDocument();
    });
  });

  describe('when a key is saved', () => {
    it('PUTs the key and refetches so the provider shows as configured', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none' }];
      let putBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          providers[0] = { provider: 'openai', source: 'stored' };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProvidersSection />);

      await user.type(screen.getByLabelText('Search providers'), 'openai');
      const row = rowFor('openai');

      await user.click(within(row).getByRole('button', { name: 'Add key' }));
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-test' }));
      await waitFor(() => expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument());
    });
  });

  describe('when a stored key is removed', () => {
    it('DELETEs the key and refetches so the provider drops out of search results', async () => {
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
      renderWithProviders(<ProvidersSection />);

      await user.type(screen.getByLabelText('Search providers'), 'openai');
      const row = rowFor('openai');
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

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
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('Anthropic');
      await user.click(within(rowFor('anthropic')).getByRole('button', { name: 'Sign in' }));
      await user.type(await screen.findByLabelText('Authorization code'), 'code#state');
      await user.click(screen.getByRole('button', { name: 'Complete sign in' }));

      await waitFor(() => expect(completeBody).toEqual({ sessionId: 'session-1', code: 'code#state' }));
      await waitFor(() => expect(within(rowFor('anthropic')).getByText('Signed in')).toBeInTheDocument());
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
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('xAI');
      await user.click(within(rowFor('xai')).getByRole('button', { name: 'Sign in' }));

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
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('OpenAI');
      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Sign in' }));

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
      renderWithProviders(<ProvidersSection />);

      await user.type(screen.getByLabelText('Search providers'), 'openai');
      await user.click(within(rowFor('openai')).getByRole('button', { name: 'Add key' }));
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-org');
      await user.click(screen.getByText('Everyone in org'));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-org', scope: 'org' }));
      await waitFor(() => expect(within(rowFor('openai')).getByText('Org key')).toBeInTheDocument());
    });
  });
});
